import * as Promise from 'bluebird';
import * as bodyParser from 'body-parser';
import * as Express from 'express';
import FacebookAPI from 'facebook-send-api';
import * as FacebookTypes from 'facebook-sendapi-types';
import * as http from 'http';
import * as _ from 'lodash';
import * as request from 'request-promise';
import * as util from 'util';

import { Message } from '@alana/core/lib/types/bot';
import * as Bot from '@alana/core/lib/types/bot';
import * as Messages from '@alana/core/lib/types/message';
import { PlatformMiddleware } from '@alana/core/lib/types/platform';
import { BasicUser, User } from '@alana/core/lib/types/user';

import Alana from '@alana/core';

let graph_url: string = null;

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
  protected accessToken: string;
  protected getStartedPostback: string;

  constructor(theBot: Alana, port: number = 3000, access_token: string, route: string = '/webhook', verifyToken: string = 'alana-bot') {
    this.bot = theBot;
    this.bot.addPlatform(this);
    this.port = port;
    this.accessToken = access_token;
    this.route = route;
    this.verifyToken = verifyToken;
    graph_url = process.env.FB_GRAPHURLBASE || 'https://graph.facebook.com';
    this.FBSendAPI = new FacebookAPI(access_token, `${graph_url}/v2.6`);
    this.expressApp = Express();
    this.expressApp.use(bodyParser.json());
    // this.expressApp.use((req, res, next) => {
    //   console.log(req.method, req.path, req.query);
    //   next();
    // });
    this.expressApp.get(this.route, (req, res, next) => {
      if (this.bot.debugOn) {
        console.log('Received a verify request with token', req.query['hub.verify_token']);
      }
      if (req.query['hub.verify_token'] === this.verifyToken) {
        return res.send(req.query['hub.challenge']);
      }
      return res.send('Error, wrong validation token');
    });
    this.expressApp.post(this.route, (req, res, next) => {
      const wenhookCallback: FacebookTypes.WebhookCallback = req.body;
      const messagingEvents = _.flatten(wenhookCallback.entry.map(entry => entry.messaging));
      if (this.bot.debugOn) {
        console.log(`Recieved ${messagingEvents.length} messages`);
      }
      res.sendStatus(200);
      for (let i = 0; i < messagingEvents.length; i++) {
        const event = messagingEvents[i];
        this.convertAndProcessMessage(event);
      }
    });
    return this;
  }

  public start() {
    this.server = this.expressApp.listen(this.port, () => {
      if (this.bot.debugOn) {
        console.log(`Facebook platform listening at http://localhost:${this.port}${this.route}`);
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

  protected convertAndProcessMessage(event: FacebookTypes.WebhookPayload): Promise<void> {
    const emptyPromise = Promise.resolve();
    if (event.message && event.message.is_echo) {
      if (this.bot.debugOn) {
        console.log('Received a message echo');
      }
      return emptyPromise;
    }

    if (event.delivery) {
      if (this.bot.debugOn) {
        console.log('Received a delivery confirmation');
      }
      return emptyPromise;
    }

    if (event.read) {
      if (this.bot.debugOn) {
        console.log('Received a read confirmation');
      }
      return emptyPromise;
    }

    const user: BasicUser = {
      _platform: this,
      id: event.sender.id,
      platform: 'Facebook',
    };

    if (event.message) {
      if (event.message.quick_reply) {
        const payload  = event.message.quick_reply.payload;
        const message: Message.PostbackMessage = {
          type: 'postback',
          payload: payload,
        };
        if (this.bot.debugOn) {
          console.log('Received a quick reply message', payload);
        }
        return this.processMessage(user, message);
      }

      if (event.message.text) {
        const text = event.message.text;
        const message: Message.TextMessage = {
          type: 'text',
          text: text,
        };
        if (this.bot.debugOn) {
          console.log('Received a text message', text);
        }
        return this.processMessage(user, message);
      }

      if (event.message.attachments) {
        const promises = event.message.attachments.map((attachement) => {
          if (this.bot.debugOn) {
            console.log('Received an attachement message of type', attachement.type);
          }
          switch (attachement.type) {
            case 'image': {
              const message: Message.ImageMessage = {
                type: 'image',
                url: attachement.payload.url,
              };
              return this.processMessage(user, message);
            }
            // case 'audio': {
            //   const message: Message.AudioMessage = {
            //     type: 'audio',
            //     url: attachement.payload.url,
            //   };
            //   return this.processMessage(user, message);
            // }
            // case 'video': {
            //   const message = {
            //     type: 'video',
            //     url: attachement.payload.url,
            //   };
            //   return this.processMessage(user, message);
            // }
            // case 'file': {
            //   const message = {
            //     type: 'file',
            //     url: attachement.payload.url,
            //   };
            //   return this.processMessage(user, message);
            // }
            // case 'location': {
            //   const message = {
            //     type: 'location',
            //     coordinates: attachement.payload.coordinates,
            //   };
            //   return this.processMessage(user, message);
            // }
            default: {
              console.error(`Can't handle ${attachement.type} message type`);
              return emptyPromise;
            }
          }
        });
        return Promise.all(promises).then(() => { return; });
      }
    }

    if (event.postback) {
      const payload = event.postback.payload;
      if (payload === this.getStartedPostback) {
        const greeting: Message.GreetingMessage = {
          type: 'greeting',
        };
        if (this.bot.debugOn) {
          console.log('New user, sending greeting', payload);
        }
        return this.processMessage(user, greeting);
      }
      // const referal = event.postback.refferal;
      const message: Message.PostbackMessage = {
        type: 'postback',
        payload: payload,
      };
      if (this.bot.debugOn) {
        console.log('Received an postback', payload);
      }
      return this.processMessage(user, message);
    }

    if (this.bot.debugOn) {
      console.log('Received an unknown message', event);
    }
    return emptyPromise;
  }

  protected processMessage(user: BasicUser, message: Message.IncomingMessage) {
    return this.bot.processMessage(user, message);
  }

  public getUser(id: string): Promise<FacebookTypes.FacebookUser | {}> {
    return request({
      uri: `${graph_url}/v2.6/${id}`,
      method: 'GET',
      qs: {
        fields: 'first_name,last_name,profile_pic,locale,timezone,gender',
        access_token: this.accessToken,
      },
    })
    .then((response: FacebookTypes.FacebookUser | {}) => {
      return response;
    });
  }

  public setPersistentMenuCTA(items: Array<FacebookTypes.MessengerButton>, composer_input_disabled: boolean = false, locale: string = 'default') {
    return request({
      uri: `${graph_url}/v2.6/me/messenger_profile`,
      method: 'POST',
      json: true,
      qs: {
        access_token: this.accessToken,
      },
      body: {
        persistent_menu: [
          {
            locale: locale,
            composer_input_disabled: composer_input_disabled,
            call_to_actions: items,
          }
        ],
      },
    })
    .then((response) => {
      if (response.result && response.result === 'success') {
        return;
      }
      throw new Error('Not sucessfull');
    });
  }

  public setGetStartedPayload(payload: string) {
    this.getStartedPostback = payload;
    return request({
      uri: `${graph_url}/v2.6/me/messenger_profile`,
      method: 'POST',
      json: true,
      qs: {
        access_token: this.accessToken,
      },
      body: {
        get_started: {
          payload: payload,
        },
      },
    })
    .then((response) => {
      if (response.result && response.result === 'success') {
        return;
      }
      throw new Error('Not sucessfull');
    });
  }
  public setGreeting(text: string, locale: string = 'default') {
    return request({
        uri: `${graph_url}/v2.6/me/messenger_profile`,
        method: 'POST',
        json: true,
        qs: {
          access_token: this.accessToken,
        },
        body: {
          greeting: [
            {
              locale: locale,
              text: text,
            },
          ],
        },
      })
      .then((response) => {
        if (response.result && response.result === 'success') {
          return;
        }
        throw new Error('Not sucessfull');
      });
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
            const fb: FacebookTypes.MessengerWebButton = {
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
