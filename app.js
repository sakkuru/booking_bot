const restify = require('restify');
const builder = require('botbuilder');
const qr = require('qr-image');
const fs = require('fs');

// use console
// const connector = new builder.ConsoleConnector().listen();

// use emulator
const server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3979, function() {
  console.log('%s listening to %s', server.name, server.url);
});
const connector = new builder.ChatConnector({
  appId: process.env.MICROSOFT_APP_ID,
  appPassword: process.env.MICROSOFT_APP_PASSWORD
});
server.post('/api/messages', connector.listen());

const bot = new builder.UniversalBot(connector);

const numbersSelector = {
  "1人": { numbers: 1 },
  "2人": { numbers: 2 },
  "3人": { numbers: 3 },
  "4人": { numbers: 4 },
  "5人以上": { numbers: 5 }
};

const zoneTypeSelector = {
  "禁煙席": {
    value: 0
  },
  "喫煙席": {
    value: 1
  },
  "どちらでもよい": {
    value: 2
  }
};

const seatTypeSelector = {
  "テーブル席": {
    value: 0
  },
  "カウンター席": {
    value: 1
  },
  "どちらでもよい": {
    value: 2
  }
};

const selected = {
  numbers: undefined,
  zoneType: undefined,
  seatType: undefined
}

bot.dialog('/', [
  function(session) {
    session.send('ようこそつばめグリルへ！');
    session.beginDialog('/numbersOfParty');
  },
  function(session, results) {
    session.beginDialog('/zoneType');
  },
  function(session, results) {
    session.beginDialog('/seatType');
  },
  function(session, results) {
    session.beginDialog('/confirm');
  }
]);

bot.dialog('/numbersOfParty', [
  function(session) {
    builder.Prompts.choice(session, "何名様でご利用ですか？", numbersSelector);
  },
  function(session, results, next) {
    selected.numbers = numbersSelector[results.response.entity].numbers;
    if (selected.numbers >= 5) {
      builder.Prompts.number(session, "人数を入力してください。");
    } else {
      next();
    }
  },
  function(session, results) {
    selected.numbers = selected.numbers || results.response;
    session.send('%s名様ですね。', selected.numbers);
    session.endDialog();
  }
]);

bot.dialog('/zoneType', [
  function(session) {
    builder.Prompts.choice(session, "禁煙席と喫煙席はどちらをご希望ですか？", zoneTypeSelector);
  },
  function(session, results) {
    selected.zoneType = results.response.entity;
    session.send('%sですね。', selected.zoneType);
    session.endDialog();
  }
]);

bot.dialog('/seatType', [
  function(session) {
    builder.Prompts.choice(session, "シートタイプはどちらをご希望ですか？", seatTypeSelector);
  },
  function(session, results) {
    selected.seatType = results.response.entity;
    session.send('%sですね。', selected.seatType);
    session.endDialog();
  }
]);

bot.dialog('/confirm', [
  function(session) {
    session.send("%(numbers)s名様 %(zoneType)s %(seatType)s", selected);
    builder.Prompts.confirm(session, "以上でよろしいですか？");
  },
  function(session, results) {
    if (!results.response) {
      session.beginDialog('/numbersOfParty');
    }

    session.send('かしこまりました。\n下記のQRコードをアプリで読み込んでください。');

    const codeData = {
      number: selected.numbers,
      smoke: zoneTypeSelector[selected.zoneType].value,
      table: seatTypeSelector[selected.seatType].value
    }

    // generate and send QR code image
    const qr_png = qr.image(JSON.stringify(codeData), { type: 'png' });
    qr_png.pipe(require('fs').createWriteStream('qrcode.png'));
    const DataURI = require('datauri').promise;
    DataURI('qrcode.png')
      .then(content => {
        console.log(content);
        const msg = new builder.Message(session)
          .attachments([{
            contentType: "image/png",
            contentUrl: content
          }]);
        session.send(msg);
      })
      .catch(err => { throw err; });

    session.send('アプリがお呼び出しするまで、少々お待ちください。ご利用ありがとうございました。');
    session.endDialog();
  }
]);