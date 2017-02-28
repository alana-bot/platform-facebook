/// <reference types="bluebird" />
import * as Promise from 'bluebird';
import * as FacebookTypes from 'facebook-sendapi-types';
import { Message } from 'alana-core/lib/types/bot';
import * as Messages from 'alana-core/lib/types/message';
import { PlatformMiddleware } from 'alana-core/lib/types/platform';
import { User } from 'alana-core/lib/types/user';
import Alana from 'alana-core';
export default class Facbook implements PlatformMiddleware {
    protected bot: Alana;
    private port;
    private route;
    private expressApp;
    private server;
    private verifyToken;
    private FBSendAPI;
    constructor(theBot: Alana, port?: number, route?: string, verifyToken?: string);
    start(): Promise<this>;
    stop(): Promise<this>;
    send<U extends User, M extends Message.Message>(user: U, message: M): Promise<this>;
    private processMessage(event);
    private processPostback(user, event);
    private processText(user, event);
}
export declare function mapInternalToFB<M extends Messages.Message>(message: M): FacebookTypes.MessengerMessage;
