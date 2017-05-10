const converter = require('../lib/index').mapFBToInternal;

const message = {
  "sender": {
      "id": "SENDER_ID"
  },
  "recipient": {
      "id": "recipient"
  },
  "timestamp": 1476005654334,
  "message": {
      "mid": "mid",
      "seq": 168,
      "sticker_id": 369239263222822,
      "attachments": [{
          "type": "image",
          "payload": {
              "url": "https:\/\/scontent.xx.fbcdn.net\/t39.1997-6\/851557_369239266556155_759568595_n.png?_nc_ad=z-m",
              "sticker_id": 369239263222822
          }
      }]
  }
};

describe('sticker message', function(){
  it('convert to image', function(){
    const internal = converter(message);
    if (internal == null) {
      throw new Error('cant convert stcicker message');
    }
    if (internal.type !== 'image') {
      throw new Error('sticker is not an image');
    }
    if (internal.url !== message.message.attachments[0].payload.url) {
      throw new Error('sticker has bad url');
    }
  });
});
