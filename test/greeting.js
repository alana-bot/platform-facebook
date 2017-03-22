const BotTester = require('messenger-bot-tester');
const Alana = require('@alana/core');
const FB = require('../lib/index').default;

describe('get started', function() {
  // webHookURL points to where yout bot is currently listening
  // choose a port for the test framework to listen on
  const testingPort = Math.round(Math.random()*1000) + 3000;
  const botPort = Math.round(Math.random()*1000) + 4000;
  const webHookURL = 'http://localhost:' + botPort + '/webhook';
  const tester = new BotTester.default(testingPort, webHookURL);
  process.env.FB_GRAPHURLBASE = `http://localhost:${testingPort}`;
  const bot = new Alana.default();
  bot.turnOnDebug();
  const platform = new FB(bot, botPort, 'access_token');

  before(function(){
    // start your own bot here or having it running already in the background
    // redirect all Facebook Requests to http://localhost:3100/v2.6 and not https://graph.facebook.com/v2.6

    bot.start();
    return tester.startListening();
  });
  
  it.only('using postback', function(){
    bot.addGreeting((user, response) => {
      response.sendText('hello new user');
    })
    bot.newScript()
      .button.always('get_started', (session, response) => {
        console.log('absorb getting started', session.message);
      })
      .expect.button((sessions, response) => {
        throw new Error('Did not eat button');
      })
    const theScript = new BotTester.Script(Math.round(Math.random()*1000), '20');
    theScript.sendPostbackMessage('get_started');
    theScript.expectTextResponse('hello new user');
    return tester.runScript(theScript);
  });
})