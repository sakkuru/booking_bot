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
  appId: "e44703b5-da54-44c0-9fff-fb6545eb1112",
  appPassword: "WMHRm7tyGnp1O5QP6HqbWRy"
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

    counter++;
    const codeData = {
      id: counter.toString(),
      capacity: selected.numbers,
      smoke: zoneTypeSelector[selected.zoneType].value,
      type: seatTypeSelector[selected.seatType].value
    }

    // Add booking data to database
    addNewBooking(codeData);

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


let counter = 20;

const addNewBooking = bookingData => {
  addNewDocument(bookingData);
}

const DocumentClient = require('documentdb').DocumentClient;

const host = "https://botable.documents.azure.com:443"; // Add your endpoint
const masterKey = "Qp2YxwT8uNCTrhuKR3pUCnLkgbEkQWu1CcD0TQzAq67VCeqIKBWiyHRSwyNbQaejcYioptYY0JSraNNK1pByvQ=="; // Add the masterkey of the endpoint
const client = new DocumentClient(host, { masterKey: masterKey });

const databaseId = 'store';
const collectionId = 'party';

const databaseUrl = `dbs/${databaseId}`;
const collectionUrl = `${databaseUrl}/colls/${collectionId}`;

const getDatabase = () => {
  console.log(`Getting database:\n${databaseId}\n`);

  return new Promise((resolve, reject) => {
    client.readDatabase(databaseUrl, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

getCollection = () => {
  console.log(`Getting collection:\n${collectionId}\n`);

  return new Promise((resolve, reject) => {
    client.readCollection(collectionUrl, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

const getDocument = document => {
  let documentUrl = `${collectionUrl}/docs/${document.id}`;
  console.log(`Getting document:\n${document.id}\n`);

  return new Promise((resolve, reject) => {
    client.readDocument(documentUrl, { partitionKey: document.id }, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
};

const addNewDocument = document => {
  let documentUrl = `${collectionUrl}/docs/${document.id}`;
  console.log(`Adding document:\n${document.id}\n`);
  console.log(document);

  return new Promise((resolve, reject) => {
    client.createDocument(collectionUrl, document, (err, created) => {
      if (err) reject(err)
      else resolve(created);
    });

  })
}

// debug code
// getDatabase()
//   .then(result => {
//     console.log(result);
//     return getCollection();
//   }).then(result => {
//     console.log(result);
//     return addNewDocument({ id : "1" })
//   }).then(result => {
//     console.log(result);
//     return getDocument({ id: "1" })
//   }).then(res => {
//     console.log(res)
//   })