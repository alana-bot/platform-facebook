/// <reference types="bluebird" />
import * as Promise from 'bluebird';
import * as FacebookTypes from 'facebook-sendapi-types';
import { Message } from '@alana/core/lib/types/bot';
import * as Messages from '@alana/core/lib/types/message';
import { PlatformMiddleware } from '@alana/core/lib/types/platform';
import { BasicUser, User } from '@alana/core/lib/types/user';
import Alana from '@alana/core';
export default class Facbook implements PlatformMiddleware {
    protected bot: Alana;
    private port;
    private route;
    private expressApp;
    private server;
    private verifyToken;
    private FBSendAPI;
    protected accessToken: string;
    protected getStartedPostback: string;
    constructor(theBot: Alana, port: number, access_token: string, route?: string, verifyToken?: string);
    start(): Promise<this>;
    stop(): Promise<this>;
    send<U extends User, M extends Message.Message>(user: U, message: M): Promise<this>;
    protected convertAndProcessMessage(event: FacebookTypes.WebhookPayload): Promise<void>;
    protected processMessage(user: BasicUser, message: Message.IncomingMessage): Promise<void>;
    getUser(id: string): Promise<FacebookTypes.FacebookUser | {}>;
    setPersistentMenuCTA(items: Array<FacebookTypes.MessengerButton>, composer_input_disabled?: boolean, locale?: string): Promise<void>;
    setGetStartedPayload(payload: string): Promise<void>;
    setGreeting(text: string, locale?: string): Promise<void>;
}
export declare function mapInternalToFB<M extends Messages.Message>(message: M): FacebookTypes.MessengerMessage;
