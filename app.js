'use strict';
const Twitter = require('twitter-lite');
const cron = require('cron').CronJob;

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

 /*  for (let checkedTweet of checkedTweets) {
    // 連投は無視する
    if(checkedTweets.id_str === homeTimeLineTweet.id_str || checkedTweet.text === homeTimeLineTweet.text) {
      return true;
    }
  }

  return false;
*/
}

const responses = ['面白い！', 'すごい！', 'へー', 'そうなんだ！' ];

let responseHomeTimeLine = (homeTimeLineTweet) => {
  let response = responses[Math.floor(Math.random() * responses.length)];
  const tweetMessage = `@${homeTimeLineTweet.user.screen_name} 「${homeTimeLineTweet.text} ${response}」`
  twitter.post('statuses/update', {
    status: tweetMessage,
    in_reply_to_status_id: homeTimeLineTweet.id_str
  }).then((tweet) => {
    console.log(tweet);
}).catch((err) => {
    console.log(err);
  });
}

// 定期的に実行する処理
const CronJob = new cron({
  cronTime: '00 0-59/2 * * * *',  // 2分ごとに実行する
  start: true,
  onTick: () => {
    getHomeTimeLine();
  } 
});

getHomeTimeLine();

