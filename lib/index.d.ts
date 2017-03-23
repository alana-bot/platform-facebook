/// <reference types="request-promise" />
/// <reference types="bluebird" />
import * as Promise from 'bluebird';
import * as FacebookTypes from 'facebook-sendapi-types';
import * as request from 'request-promise';
import { Message } from '@alana/core/lib/types/bot';
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
    protected accessToken: string;
    protected getStartedPostback: string;
    graph_url: string;
    constructor(theBot: Alana, port: number, access_token: string, route?: string, verifyToken?: string);
    protected sendMessage(payload: FacebookTypes.MessengerPayload): request.RequestPromise;
    start(): Promise<this>;
    stop(): Promise<this>;
    send<U extends User>(user: U, message: Message.OutgoingMessage): Promise<this>;
    protected processMessage(user: BasicUser, message: Message.IncomingMessage): Promise<void>;
    setGetStartedPayload(payload: string): void;
}
export declare function mapFBToInternal(event: FacebookTypes.WebhookPayload, getStartedPayload?: string): Message.IncomingMessage;
export declare function mapInternalToFB(message: Message.OutgoingMessage): FacebookTypes.MessengerPayload;
