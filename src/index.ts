import * as Promise from 'bluebird';
import * as bodyParser from 'body-parser';
import * as Express from 'express';
import FacebookAPI from 'facebook-send-api';
import * as FacebookTypes from 'facebook-sendapi-types';
import * as http from 'http';
import * as _ from 'lodash';

import { Message } from '@alana/core/lib/types/bot';
import * as Bot from '@alana/core/lib/types/bot';
import * as Messages from '@alana/core/lib/types/message';
import { PlatformMiddleware } from '@alana/core/lib/types/platform';
import { BasicUser, User } from '@alana/core/lib/types/user';

import Alana from '@alana/core';

interface WebhookCallback {
  object: 'page';
  entry: Array<{
    id: string;
    time: number;
    messaging: Array<Event>;
  }>;
}

export default class Facbook implements PlatformMiddleware {
  protected bot: Alana;
  private port: number;
  private route: string;
  private expressApp: Express.Express;
  private server: http.Server = null;
  private verifyToken: string;
  private FBSendAPI: FacebookAPI;

  constructor(theBot: Alana, port: number = 3000, route: string = '/webhook', verifyToken: string = 'alana-bot') {
    this.bot = theBot;
    this.bot.addPlatform(this);
    this.port = port;
    this.route = route;
    this.verifyToken = verifyToken;
    this.FBSendAPI = new FacebookAPI(verifyToken);
    this.expressApp = Express();
    this.expressApp.use(bodyParser.json());
    this.expressApp.get(this.route, (req, res, next) => {
      if (req.query['hub.verify_token'] === this.verifyToken) {
        return res.send(req.query['hub.challenge']);
      }
      return res.send('Error, wrong validation token');
    });
    this.expressApp.post(this.route, (req, res, next) => {
      const wenhookCallback: FacebookTypes.WebhookCallback = req.body;
      const messagingEvents = _.flatten(wenhookCallback.entry.map(entry => entry.messaging));
      for (let i = 0; i < messagingEvents.length; i++) {
        const event = messagingEvents[i];
        this.processMessage(event);
      }
    });
  }

  public start() {
    this.server = this.expressApp.listen(this.port, () => {
      if (this.bot.debugOn) {
        console.log(`Facebook platform listening on port ${this.port}`);
      }
    });
    return Promise.resolve(this);
  }

  public stop() {
    this.server.close(() => {
      if (this.bot.debugOn) {
        console.log('Facebook platform stopped');
      }
    });
    this.server = null;
    return Promise.resolve(this);
  }

  public send<U extends User, M extends Message.Message>(user: U, message: M): Promise<this> {
    const facebookMessage = mapInternalToFB(message);
    return this.FBSendAPI.sendMessageToFB(user.id, facebookMessage)
      .then(() => this);
  }

  private processMessage(event: FacebookTypes.WebhookPayload) {
    if (event.message && event.message.is_echo) {
      return;
    }

    if (event.delivery) {
      return;
    }

    if (event.read) {
      return;
    }

    const user: BasicUser = {
      _platform: this,
      id: event.sender.id,
      platform: 'Facebook',
    };
    if (event.message && event.message.quick_reply) {
      this.processPostback(user, event);
    }

    if (event.message && event.message.text) {
      this.processText(user, event);
    }

    // if (event.message && event.message.attachment.type === "image") {

    // }

    if (event.postback) {
      this.processPostback(user, event);
    }
  }

  private processPostback(user: BasicUser, event: FacebookTypes.WebhookPayload) {
    const message: Message.PostbackMessage = {
      payload: event.postback.payload,
      type: 'postback',
    };
    this.bot.processMessage(user, message);
  }

  private processText(user: BasicUser, event: FacebookTypes.WebhookPayload) {
    const message: Message.TextMessage = {
      text: event.message.text,
      type: 'text',
    };
    this.bot.processMessage(user, message);
  }
}

export function mapInternalToFB<M extends Messages.Message>(message: M): FacebookTypes.MessengerMessage {
  switch (message.type) {
    case 'text':
      return FacebookAPI.exportTextMessage((<Messages.TextMessage> (message as any)).text);

    case 'button': {
      const buttonMessage: Messages.ButtonMessage = <any> message;
      const FBButtons: Array<FacebookTypes.MessengerButton> = buttonMessage.buttons.map(button => {
        switch (button.type) {
          case 'postback': {
            const fb: FacebookTypes.MessengerPostbackButton = {
              type: 'postback',
              title: button.text,
              payload: button.payload,
            };
            return fb;
          }

          case 'url': {
            const fb: FacebookTypes.MessengerButton = {
              type: 'web_url',
              title: button.text,
              url: button.url,
            };
            return fb;
          }

          default:
            throw new Error('Unknown button type');
        }
      });
      return FacebookAPI.exportButtonMessage(buttonMessage.text, FBButtons);
    }

    default:
      return null;
  }
}
