"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Promise = require("bluebird");
var bodyParser = require("body-parser");
var Express = require("express");
var _ = require("lodash");
var request = require("request-promise");
var Facbook = (function () {
    function Facbook(theBot, port, access_token, route, verifyToken) {
        if (port === void 0) { port = 3000; }
        if (route === void 0) { route = '/webhook'; }
        if (verifyToken === void 0) { verifyToken = 'alana-bot'; }
        var _this = this;
        this.server = null;
        this.graph_url = 'https://graph.facebook.com';
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
        this.expressApp.get(this.route, function (req, res, next) {
            if (_this.bot.debugOn) {
                console.log('Received a verify request with token', req.query['hub.verify_token']);
            }
            if (req.query['hub.verify_token'] === _this.verifyToken) {
                return res.send(req.query['hub.challenge']);
            }
            return res.send('Error, wrong validation token');
        });
        this.expressApp.post(this.route, function (req, res, next) {
            var wenhookCallback = req.body;
            var messagingEvents = _.flatten(wenhookCallback.entry.map(function (entry) { return entry.messaging; }));
            if (_this.bot.debugOn) {
                console.log("Recieved " + messagingEvents.length + " messages");
            }
            res.sendStatus(200);
            for (var i = 0; i < messagingEvents.length; i++) {
                var event_1 = messagingEvents[i];
                _this.convertAndProcessMessage(event_1);
            }
        });
        return this;
    }
    Facbook.prototype.sendMessage = function (payload) {
        return request({
            uri: this.graph_url + "/v2.6/me/messages",
            method: 'POST',
            qs: {
                access_token: this.accessToken,
            },
            json: true,
            body: payload,
        });
    };
    Facbook.prototype.start = function () {
        var _this = this;
        this.server = this.expressApp.listen(this.port, function () {
            if (_this.bot.debugOn) {
                console.log("Facebook platform listening at http://localhost:" + _this.port + _this.route);
            }
        });
        return Promise.resolve(this);
    };
    Facbook.prototype.stop = function () {
        var _this = this;
        this.server.close(function () {
            if (_this.bot.debugOn) {
                console.log('Facebook platform stopped');
            }
        });
        this.server = null;
        return Promise.resolve(this);
    };
    Facbook.prototype.send = function (user, message) {
        var _this = this;
        var facebookMessage = mapInternalToFB(message);
        facebookMessage.recipient.id = user.id;
        return this.sendMessage(facebookMessage)
            .then(function () { return _this; });
    };
    Facbook.prototype.convertAndProcessMessage = function (event) {
        var _this = this;
        var emptyPromise = Promise.resolve();
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
        var user = {
            _platform: this,
            id: event.sender.id,
            platform: 'Facebook',
        };
        if (event.message) {
            if (event.message.quick_reply) {
                var payload = event.message.quick_reply.payload;
                var message = {
                    type: 'postback',
                    payload: payload,
                };
                if (this.bot.debugOn) {
                    console.log('Received a quick reply message', payload);
                }
                return this.processMessage(user, message);
            }
            if (event.message.text) {
                var text = event.message.text;
                var message = {
                    type: 'text',
                    text: text,
                };
                if (this.bot.debugOn) {
                    console.log('Received a text message', text);
                }
                return this.processMessage(user, message);
            }
            if (event.message.attachments) {
                var promises = event.message.attachments.map(function (attachement) {
                    if (_this.bot.debugOn) {
                        console.log('Received an attachement message of type', attachement.type);
                    }
                    switch (attachement.type) {
                        case 'image': {
                            var message = {
                                type: 'image',
                                url: attachement.payload.url,
                            };
                            return _this.processMessage(user, message);
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
                            console.error("Can't handle " + attachement.type + " message type");
                            return emptyPromise;
                        }
                    }
                });
                return Promise.all(promises).then(function () { return; });
            }
        }
        if (event.postback) {
            var payload = event.postback.payload;
            if (payload === this.getStartedPostback) {
                var greeting = {
                    type: 'greeting',
                };
                if (this.bot.debugOn) {
                    console.log('New user, sending greeting', payload);
                }
                return this.processMessage(user, greeting);
            }
            // const referal = event.postback.refferal;
            var message = {
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
    };
    Facbook.prototype.processMessage = function (user, message) {
        return this.bot.processMessage(user, message);
    };
    Facbook.prototype.setGetStartedPayload = function (payload) {
        this.getStartedPostback = payload;
    };
    return Facbook;
}());
exports.default = Facbook;
function mapInternalToFB(message) {
    var payload = {
        recipient: {
            id: null,
        },
        notification_type: 'REGULAR'
    };
    switch (message.type) {
        case 'text': {
            var textMessage = {
                text: message.text,
            };
            payload.message = textMessage;
            return payload;
        }
        case 'button': {
            var FBButtons = message.buttons.map(function (button) {
                switch (button.type) {
                    case 'postback': {
                        var fb = {
                            type: 'postback',
                            title: button.text,
                            payload: button.payload,
                        };
                        return fb;
                    }
                    case 'url': {
                        var fb = {
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
            var FBPayload = {
                template_type: 'button',
                text: message.text,
                buttons: FBButtons,
            };
            var FBAttachement = {
                type: 'template',
                payload: FBPayload,
            };
            var FBMessage = {
                attachment: FBAttachement,
            };
            payload.message = FBMessage;
            return payload;
        }
        default:
            return null;
    }
}
exports.mapInternalToFB = mapInternalToFB;
