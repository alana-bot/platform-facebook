const BotTester = require('messenger-bot-tester');
const Alana = require('@alana/core');
const FB = require('../lib/index').default;

describe('button', function() {
  // webHookURL points to where yout bot is currently listening
  // choose a port for the test framework to listen on
  const testingPort = Math.round(Math.random()*1000) + 3000;
  const botPort = Math.round(Math.random()*1000) + 4000;
  const webHookURL = 'http://localhost:' + botPort + '/webhook';
  const tester = new BotTester.default(testingPort, webHookURL);
  process.env.FB_GRAPHURLBASE = `http://localhost:${testingPort}`;
  const bot = new Alana.default();
  // bot.turnOnDebug();
  const platform = new FB(bot, botPort, 'access_token');

  before(function(){
    // start your own bot here or having it running already in the background
    // redirect all Facebook Requests to http://localhost:3100/v2.6 and not https://graph.facebook.com/v2.6

    bot.start();
    return tester.startListening();
  });
  
  it('send buttons', function(){
    bot.newScript()
      .dialog((incoming, response) => {
        const buttons = response.sendButtons().text('buttons');
        buttons.addButton('postback', 'button 1', 'payload1');
        buttons.send()
      })
    const theScript = new BotTester.Script(Math.round(Math.random()*1000), '20');
    theScript.sendTextMessage('hey you');  //mock user sending "hi"
    theScript.expectButtonTemplateResponse('buttons', [
      {
        type: 'postback',
        title: 'button 1',
        payload: 'payload1',
      }
    ])
    return tester.runScript(theScript);
  });

  it('respond with postback', function(){
    bot.newScript()
      .dialog((incoming, response) => {
        const buttons = response.sendButtons().text('buttons');
        buttons.addButton('postback', 'button 1', 'payload1');
        buttons.send()
      })
      .expect.button('payload1', (session, response) => {
        response.sendText('button');
      });
    const theScript = new BotTester.Script(Math.round(Math.random()*1000), '20');
    theScript.sendTextMessage('hey you');  //mock user sending "hi"
    theScript.expectButtonTemplateResponse('buttons', [
      {
        type: 'postback',
        title: 'button 1',
        payload: 'payload1',
      }
    ])
    theScript.sendPostbackMessage('payload1');
    theScript.expectTextResponse('button');
    return tester.runScript(theScript);
  });
})