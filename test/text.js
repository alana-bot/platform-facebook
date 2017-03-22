const BotTester = require('messenger-bot-tester');
const Alana = require('@alana/core');
const FB = require('../lib/index').default;

describe('text', function() {
  // webHookURL points to where yout bot is currently listening
  // choose a port for the test framework to listen on
  const testingPort = Math.round(Math.random()*1000) + 4000;
  const botPort = Math.round(Math.random()*1000) + 4000;
  const webHookURL = 'http://localhost:' + botPort + '/webhook';
  const tester = new BotTester.default(testingPort, webHookURL);
  const bot = new Alana.default();
  const platform = new FB(bot, botPort, 'access_token');

  before(function(){
    // start your own bot here or having it running already in the background
    // redirect all Facebook Requests to http://localhost:3100/v2.6 and not https://graph.facebook.com/v2.6
    platform.graph_url = `http://localhost:${testingPort}`;
    bot.start();
    return tester.startListening();
  });
  
  it('hi', function(){
    bot.newScript()
      .dialog((incoming, response) => {
        response.sendText('hi');
      });
    const theScript = new BotTester.Script('132', '20');
    theScript.sendTextMessage('hey you');  //mock user sending "hi"
    theScript.expectTextResponses([   //either response is valid
      'hi', 
    ]);
    return tester.runScript(theScript);
  });

  it('echo', function(){
    bot.newScript()
      .dialog((incoming, response) => {
        response.sendText(incoming.message.text);
      });
    const theScript = new BotTester.Script('132', '20');
    theScript.sendTextMessage('hey');  //mock user sending "hi"
    theScript.expectTextResponses([   //either response is valid
      'hey', 
    ]);
    return tester.runScript(theScript);
  });
})