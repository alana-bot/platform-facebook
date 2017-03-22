import * as Promise from 'bluebird';
import * as bodyParser from 'body-parser';
import * as Express from 'express';
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
  protected accessToken: string;
  protected getStartedPostback: string;
  public graph_url: string = 'https://graph.facebook.com';

  constructor(theBot: Alana, port: number = 3000, access_token: string, route: string = '/webhook', verifyToken: string = 'alana-bot') {
    this.bot = theBot;
    this.bot.addPlatform(this);
    this.port = port;
    this.accessToken = access_token;
    this.route = route;
    this.verifyToken = verifyToken;
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

  protected sendMessage(payload:  FacebookTypes.MessengerPayload) {
    return request({
      uri: `${this.graph_url}/v2.6/me/messages`,
      method: 'POST',
      qs: {
        access_token: this.accessToken,
      },
      json: true,
      body: payload,
    });
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

  public send<U extends User>(user: U, message: Message.OutgoingMessage): Promise<this> {
    const facebookMessage = mapInternalToFB(message);
    facebookMessage.recipient.id = user.id;
    return this.sendMessage(facebookMessage)
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

  public setGetStartedPayload(payload: string) {
    this.getStartedPostback = payload;
  }
}

export function mapInternalToFB(message: Message.OutgoingMessage): FacebookTypes.MessengerPayload {
  const payload: FacebookTypes.MessengerPayload = {
    recipient: {
      id: null,
    },
    notification_type: 'REGULAR'
  };
  switch (message.type) {
    case 'text': {
      const textMessage: FacebookTypes.MessengerTextMessage = {
        text: message.text,
      };
      payload.message = textMessage;
      return payload;
    }

    case 'button': {
      const FBButtons: Array<FacebookTypes.MessengerButton> = message.buttons.map(button => {
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
      const FBPayload: FacebookTypes.MessengerButtonPayload = {
        template_type: 'button',
        text: message.text,
        buttons: FBButtons,
      };
      const FBAttachement: FacebookTypes.MessengerTemplateAttachement = {
        type: 'template',
        payload: FBPayload,
      };
      const FBMessage: FacebookTypes.MessengerMessage = {
        attachment: FBAttachement,
      };
      payload.message = FBMessage;
      return payload;
    }

    default:
      return null;
  }
}
