/// <reference types="bluebird" />
import * as Promise from 'bluebird';
import * as FacebookTypes from 'facebook-sendapi-types';
import { Message } from 'botler/lib/types/bot';
import * as Messages from 'botler/lib/types/message';
import { PlatformMiddleware } from 'botler/lib/types/platform';
import { User } from 'botler/lib/types/user';
import Botler from 'botler';
export default class Facbook implements PlatformMiddleware {
    protected bot: Botler;
    private port;
    private route;
    private expressApp;
    private server;
    private verifyToken;
    private FBSendAPI;
    constructor(botler: Botler, port?: number, route?: string, verifyToken?: string);
    start(): Promise<this>;
    stop(): Promise<this>;
    send<U extends User, M extends Message.Message>(user: U, message: M): Promise<this>;
    private processMessage(event);
    private processPostback(user, event);
    private processText(user, event);
}
export declare function mapInternalToFB<M extends Messages.Message>(message: M): FacebookTypes.MessengerMessage;
