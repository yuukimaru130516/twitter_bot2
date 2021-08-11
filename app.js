'use strict';
const Twitter = require('twitter-lite');
const cron = require('cron').CronJob;
const moment = require('moment-timezone');

const twitter = new Twitter({
  consumer_key: process.env.TWITTER_API_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_API_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_API_ACCESS_TOKEN_KEY,
  access_token_secret: process.env.TWITTER_API_ACCESS_TOKEN_SECRET
});

let checkedTweets = [];

// タイムラインを取得する関数
let getHomeTimeLine = () => {
  twitter.get('statuses/home_timeline')
    .then((tweets) => {
      // 初回起動時にタイムラインを全て取得
      if(checkedTweets.length === 0) {
        tweets.forEach((homeTimeLineTweet, key) => {
          checkedTweets.push(homeTimeLineTweet);
        });

        return;
      }

      // 取得したツイートが配列に入っているかを確認して、入っていないツイートに返信する
      const newTweets = [];
      tweets.forEach((homeTimeLineTweet, key) => {
        if(isCheckedTweet(homeTimeLineTweet) === false) {
          responseHomeTimeLine(homeTimeLineTweet);
          newTweets.push(homeTimeLineTweet); // 新しいツイートを配列に追加
        }
      });

      // 調査済みリストに追加して、千個を超えてたら削除
      checkedTweets = newTweets.concat(checkedTweets); // 配列の連結
      if(checkedTweets.length > 1000 ) checkedTweets.length = 1000;

    })
    .catch((err) => {
      console.log(err);
    });
}

let isCheckedTweet = (homeTimeLineTweet) => {
  // bot自身のツイートを無視する
  if(homeTimeLineTweet.user.screen_name === 'bot_RR1') {
    return true;
  }

   for (let checkedTweet of checkedTweets) {
    // 連投は無視する
    if(/*checkedTweets.id_str === homeTimeLineTweet.id_str || */checkedTweet.text === homeTimeLineTweet.text) {
      return true;
    }
  }

  return false;

}

// 返信する内容
const responses = ['面白い！', 'すごい！', 'へー', 'そうなんだ！' ];

let responseHomeTimeLine = (homeTimeLineTweet) => {
  let response = responses[Math.floor(Math.random() * responses.length)];
  const tweetMessage = `@${homeTimeLineTweet.user.screen_name} 「${homeTimeLineTweet.text}」 ${response}`
  twitter.post('statuses/update', {
    status: tweetMessage,
    in_reply_to_status_id: homeTimeLineTweet.id_str
  }).then((tweet) => {
    console.log(tweet);
}).catch((err) => {
    console.log(err);
  });
}

// Streaming API
// bot の名前がツイートされたとき返信する
const stream = twitter.stream('statuses/filter', { track: 'yuukimaru-bot' })
  .on('data', (tweet) => {
    console.log(tweet.text);

    const tweetMessage = `@${tweet.user.screen_name} 呼んだ?`;
    twitter.post('statuses/update', {
      status: tweetMessage,
      in_reply_to_status_id: tweet.id_str
    })
    .then((tweet) => {
      console.log(tweet);
    })
    .catch((err) => {
      console.err(err);
    });
  })
  .on('error', (err) => {
      console.err(err);
    });

// ダイレクトメッセージを送信する関数

const sendDirectMessage = (message) => {
  twitter.post('direct_messages/events/new', {
    event: {
      type: 'message_create',
      message_create: {
        target: {
          recipient_id: '4640967536'
        },
        message_data: {
          text: message
        }
      }
    }
  }).then((response) => {
    console.log(response);
  }).catch((err) => {
    console.error(err);
  });
}
 
sendDirectMessage('function test');

// ツイ消しを検知する

const savedTweetsMap = new Map();

const getTimeLine = () => {
  console.log('cronが起動しました');
  twitter.get('statuses/home_timeline', {conunt: 200})
    .then((tweets) => {
      tweets = dataFormats(tweets);

      // 初回起動時は取得するだけ
      if (savedTweetsMap.size === 0) {
        tweets.forEach((homeTimeLineTweet, key) => {
          savedTweetsMap.set(homeTimeLineTweet.id, homeTimeLineTweet);
        });
        console.log(savedTweetsMap);        

        return;
      }

      // ツイ消しを探索
      const oldestTime = tweets[tweets.length - 1].created_at;
      savedTweetsMap.forEach((savedTweet, key) => {
        let isFound = false;
        for (let i = 0; i < tweets.length; i++){
          if(savedTweet.created_at < oldestTime) {
            // 調査が出来なくなったツイート
            savedTweetsMap.delete(key); // 削除
            isFound = true;
            break;
          }
          if (savedTweet.id_str === tweets[i].id_str) {
            // 削除されていないツイート
            isFound = true;
            break;
          }
        }

        if( !isFound ){
          const message = `削除されたツイートが見つかりました！\n` +
                          `ユーザー名: ${savedTweet.user.name}\n` +
                          `時刻: ${savedTweet.created_at}\n` +
                          savedTweet.text;
                          sendDirectMessage(message);
                          savedTweetsMap.delete(key); // 削除 
        }
      });

      // 初回起動時以外は新しいツイートを追加する
      for (let j = 0; j < tweets.length; j++) {
        if(!savedTweetsMap.has(tweets[j].id)) {
          savedTweetsMap.set(tweets[j].id, tweets[j]);
        }
      }
      console.log(savedTweetsMap);
    })
    .catch((err) => {
    console.error(err);
  })
}

// 日付の表記を書き換える関数
const dataFormats = tweets => {
  tweets.forEach( (tweet, key) => {
    const times = tweet.created_at.split(' ');
    const date = new Date(times[1] + ' ' + times[2] + ',' + times[5] + ' ' + times[3]);
    tweet.created_at = moment(date).tz('Asia/Tokyo').format('YYYY-MM-DD HH:mm:ss');
  });

  return tweets;
}


// 定期的に実行する処理
const CronJob = new cron({
  cronTime: '00 0-59/2 * * * *',  // 2分ごとに実行する
  start: true,
  onTick: () => {
  getTimeLine();
  } 
});

getTimeLine();