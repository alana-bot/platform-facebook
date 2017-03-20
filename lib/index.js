"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Promise = require("bluebird");
var bodyParser = require("body-parser");
var Express = require("express");
var facebook_send_api_1 = require("facebook-send-api");
var _ = require("lodash");
var request = require("request-promise");
var Facbook = (function () {
    function Facbook(theBot, port, access_token, route, verifyToken) {
        if (port === void 0) { port = 3000; }
        if (route === void 0) { route = '/webhook'; }
        if (verifyToken === void 0) { verifyToken = 'alana-bot'; }
        var _this = this;
        this.server = null;
        this.bot = theBot;
        this.bot.addPlatform(this);
        this.port = port;
        this.accessToken = access_token;
        this.route = route;
        this.verifyToken = verifyToken;
        this.FBSendAPI = new facebook_send_api_1.default(verifyToken);
        this.expressApp = Express();
        this.expressApp.use(bodyParser.json());
        this.expressApp.get(this.route, function (req, res, next) {
            if (req.query['hub.verify_token'] === _this.verifyToken) {
                return res.send(req.query['hub.challenge']);
            }
            return res.send('Error, wrong validation token');
        });
        this.expressApp.post(this.route, function (req, res, next) {
            var wenhookCallback = req.body;
            var messagingEvents = _.flatten(wenhookCallback.entry.map(function (entry) { return entry.messaging; }));
            res.sendStatus(200);
            for (var i = 0; i < messagingEvents.length; i++) {
                var event_1 = messagingEvents[i];
                _this.convertAndProcessMessage(event_1);
            }
        });
    }
    Facbook.prototype.start = function () {
        var _this = this;
        this.server = this.expressApp.listen(this.port, function () {
            if (_this.bot.debugOn) {
                console.log("Facebook platform listening on port " + _this.port);
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
        return this.FBSendAPI.sendMessageToFB(user.id, facebookMessage)
            .then(function () { return _this; });
    };
    Facbook.prototype.convertAndProcessMessage = function (event) {
        var _this = this;
        var emptyPromise = Promise.resolve();
        if (event.message && event.message.is_echo) {
            return emptyPromise;
        }
        if (event.delivery) {
            return emptyPromise;
        }
        if (event.read) {
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
                return this.processMessage(user, message);
            }
            if (event.message.text) {
                var text = event.message.text;
                var message = {
                    type: 'text',
                    text: text,
                };
                return this.processMessage(user, message);
            }
            if (event.message.attachments) {
                var promises = event.message.attachments.map(function (attachement) {
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
            // const referal = event.postback.refferal;
            var message = {
                type: 'postback',
                payload: payload,
            };
            return this.processMessage(user, message);
        }
        return emptyPromise;
    };
    Facbook.prototype.processMessage = function (user, message) {
        return this.bot.processMessage(user, message);
    };
    Facbook.prototype.getUser = function (id) {
        return request({
            uri: "https://graph.facebook.com/v2.6/" + id,
            method: 'GET',
            qs: {
                fields: 'first_name,last_name,profile_pic,locale,timezone,gender',
                access_token: this.accessToken,
            },
        })
            .then(function (response) {
            return response;
        });
    };
    Facbook.prototype.setPersistentMenuCTA = function (items, composer_input_disabled, locale) {
        if (composer_input_disabled === void 0) { composer_input_disabled = false; }
        if (locale === void 0) { locale = 'default'; }
        return request({
            uri: "https://graph.facebook.com/v2.6/me/messenger_profile",
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
            .then(function (response) {
            if (response.result && response.result === 'success') {
                return;
            }
            throw new Error('Not sucessfull');
        });
    };
    Facbook.prototype.setGetStartedPayload = function (payload) {
        return request({
            uri: "https://graph.facebook.com/v2.6/me/messenger_profile",
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
            .then(function (response) {
            if (response.result && response.result === 'success') {
                return;
            }
            throw new Error('Not sucessfull');
        });
    };
    Facbook.prototype.setGreeting = function (text, locale) {
        if (locale === void 0) { locale = 'default'; }
        return request({
            uri: "https://graph.facebook.com/v2.6/me/messenger_profile",
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
            .then(function (response) {
            if (response.result && response.result === 'success') {
                return;
            }
            throw new Error('Not sucessfull');
        });
    };
    return Facbook;
}());
exports.default = Facbook;
function mapInternalToFB(message) {
    switch (message.type) {
        case 'text':
            return facebook_send_api_1.default.exportTextMessage(message.text);
        case 'button': {
            var buttonMessage = message;
            var FBButtons = buttonMessage.buttons.map(function (button) {
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
            return facebook_send_api_1.default.exportButtonMessage(buttonMessage.text, FBButtons);
        }
        default:
            return null;
    }
}
exports.mapInternalToFB = mapInternalToFB;
