import Twit from 'twit';
import dotenv from 'dotenv';

dotenv.config();

let T = new Twit({
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_KEY_SECRET,
    access_token: process.env.ACCESS_TOKEN,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET,
    timeout_ms: 60 * 1000
})

function getTimeStamp(count) {
    console.log(`---TURN ${count}: ${Math.floor(Date.now() / 1000)}---`);
}

async function setTweet(text, data = {}) {
    return new Promise((resolve, reject) => {
        T.post('statuses/update', { status: text, ...data })
            .then(result => {
                console.log(`Success tweet https://twitter.com/${result.data.user.screen_name}/status/${result.data.id_str}`);
                resolve(result);
            })
            .catch(err => {
                console.log(`Error: tweet()\n`);
                reject(err);
            })
    })
}

async function getUserById(id) {
    return new Promise((resolve, reject) => {
        T.get('users/lookup', { user_id: id })
            .then(result => {
                resolve(result);
            })
            .catch(err => {
                console.log('Error: getUserById()\n');
                reject(err);
            })
    })
};

async function getDirectMessage() {
    return new Promise((resolve, reject) => {
        T.get('direct_messages/events/list')
            .then(result => {
                let messages = result.data.events;
                console.log(`Get ${messages.length} direct messages`);
                resolve(result);
            })
            .catch(err => {
                console.log('Error: getDirectMessage()\n');
                // for (let i = 0; i < err.allErrors.length; i++) {
                //     console.log(err.allErrors[i].message);
                // }
                // console.log('\n');
                reject(err);
            })
    })
};

async function sendDirectMessage(text, id) {
    return new Promise((resolve, reject) => {
        let event = {
            'type': 'message_create',
            'message_create': {
                'target': {
                    'recipient_id': id
                },
                'message_data': {
                    'text': text
                }
            }
        }
        T.post('direct_messages/events/new', { event: event })
            .then(result => {
                getUserById(result.data.event.message_create.target.recipient_id)
                    .then(user => {
                        console.log(`Send direct message to @${user.data[0].screen_name}`);
                        resolve(result);
                    });
            })
            .catch(err => {
                console.log('Error: sendDirectMessage()\n');
                reject(err);
            })
    })
};

async function deleteMessage(message) {
    return new Promise((resolve, reject) => {
        T.delete('direct_messages/events/destroy', { id: message.id })
            .then(result => {
                let text = message.message_create.message_data.text;
                console.log(`Delete direct message: ${text.substring(0, 15) + (text.length > 15 ? '...' : '')}`);
                resolve(result);
            })
            .catch(err => {
                console.log(`Error: deleteMessage(${message.id})`);
                reject(err);
            })
    })
};

async function main() {
    let retval;
    let messages = (await getDirectMessage()).data.events;
    if (messages != Error) {
        for (let i = 0; i < messages.length; i++) {
            let message = messages[i];
            let text = message.message_create.message_data.text;
            if (text.includes(process.env.TRIGGER)) {
                await deleteMessage(message);
                while (text.length > 280) { // blm finish, harusnya lanjut di reply
                    let temp = text.substring(0, 277) + '...';
                    await setTweet(temp);
                    text = text.substring(277);
                }
                retval = await setTweet(text);
                if (retval != Error) {
                    await sendDirectMessage(`Menfess kamu berhasil dikirim.\nhttps://twitter.com/${retval.data.user.screen_name}/status/${retval.data.id_str}`, message.message_create.sender_id);
                }
            }
        }
    }
}

let timeStart = Date.now();
let count = 0;
while (true) {
    if (count == 0 || Date.now() - timeStart >= 1 * 60 * 1000) {
        getTimeStamp(count + 1);
        await main();
        timeStart = Date.now();
        count++;
    }
}