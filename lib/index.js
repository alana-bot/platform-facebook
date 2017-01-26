"use strict";
var Promise = require("bluebird");
var bodyParser = require("body-parser");
var Express = require("express");
var facebook_send_api_1 = require("facebook-send-api");
var _ = require("lodash");
var Facbook = (function () {
    function Facbook(botler, port, route, verifyToken) {
        if (port === void 0) { port = 3000; }
        if (route === void 0) { route = '/webhook'; }
        if (verifyToken === void 0) { verifyToken = 'botler'; }
        var _this = this;
        this.server = null;
        this.bot = botler;
        this.port = port;
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
            for (var i = 0; i < messagingEvents.length; i++) {
                var event_1 = messagingEvents[i];
                _this.processMessage(event_1);
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
    Facbook.prototype.processMessage = function (event) {
        if (event.message && event.message.is_echo) {
            return;
        }
        if (event.delivery) {
            return;
        }
        if (event.read) {
            return;
        }
        var user = {
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
    };
    Facbook.prototype.processPostback = function (user, event) {
        var message = {
            payload: event.postback.payload,
            type: 'postback',
        };
        this.bot.processMessage(user, message);
    };
    Facbook.prototype.processText = function (user, event) {
        var message = {
            text: event.message.text,
            type: 'text',
        };
        this.bot.processMessage(user, message);
    };
    return Facbook;
}());
Object.defineProperty(exports, "__esModule", { value: true });
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
            return facebook_send_api_1.default.exportButtonMessage(buttonMessage.text(), FBButtons);
        }
        default:
            return null;
    }
}
exports.mapInternalToFB = mapInternalToFB;
