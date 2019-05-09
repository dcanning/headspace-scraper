var Promise = require('bluebird');
var express = require('express');
var fs = Promise.promisifyAll(require('fs'));
var request = require('request'); //.defaults({jar: jar}));
const jar = request.jar()
request = Promise.promisifyAll(request.defaults({
    jar: jar
}));
var cheerio = require('cheerio');
var app = express();
var moment = require('moment');

var jwt;
var args = process.argv.slice(2);
var username = args[0];
var passwd = args[1];
var today = moment(args[2]);
var profilePath = process.env['USERPROFILE'];

console.log(username);
console.log(passwd);

console.log(profilePath);

async function main() {
while(moment().isAfter(today)) {

    console.log(today);

    await request.getAsync('https://www.headspace.com/login/check')
        .then((x) => {
            // console.log(x);
            return request.postAsync('https://www.headspace.com/login/check', {
                    formData: {
                        _username: username,
                        _password: passwd
                    }
                })
                .then((html) => {
                    // console.log(html);
                    var cookies = html.headers['set-cookie']
                    // console.log(cookies);
                    jwt = cookies.find(x => x.startsWith('hsngjwt=')).split(';')[0].split('=')[1];
                    // console.log(jwt);
                    // res.status(200).send('OK');
                    return request.postAsync('https://api.prod.headspace.com/auth/tokens/email', {
                            formData: {
                                email: username,
                                password: passwd,
                                platform: 'DESKTOP'
                            }
                        })
                        .then((html2) => {
                            // console.log(html2);
                            var userInfo = JSON.parse(html2.toJSON().body);
                            // console.log(userInfo);
                            var userId = userInfo.included.find(x => x.type === 'users').attributes.userId;
                            // console.log(userId);
                            // res.status(200).send(userInfo);
                            return request.getAsync(`https://api.prod.headspace.com/content/view-models/everyday-headspace-banner?date=${today.format('YYYY-MM-DD')}&userId=${userId}`, {
                                    auth: {
                                        bearer: jwt
                                    }
                                })
                                .then((html3) => {
                                    // console.log(html3);
                                    var todaysInfo = JSON.parse(html3.toJSON().body);
                                    // console.log(todaysInfo);
                                    var filename = todaysInfo.data.attributes.titleText.replace(/\s/gi, '-');
                                    // console.log(filename);
                                    var tenMinuteId = todaysInfo.included.find(x => x.attributes.duration === 10).relationships.mediaItem.data.id;
                                    // console.log(tenMinuteId);
                                    var tenMinuteMedia = todaysInfo.included.find(x => x.id === tenMinuteId);
                                    // console.log(tenMinuteMedia);
                                    // res.status(200).send(todaysInfo);
                                    return request.getAsync(`https://api.prod.headspace.com/content/media-items/${tenMinuteId}/make-signed-url?mp3=true`, {
                                            auth: {
                                                bearer: jwt
                                            }
                                        })
                                        .then((html4) => {
                                            // console.log(html4);
                                            var url = JSON.parse(html4.toJSON().body).url;
                                            // console.log(url)
                                            // res.status(200).send(html4.body);
                                            return request.getAsync(url, {
                                                    auth: {
                                                        bearer: jwt
                                                    },
                                                    timeout: 600000,
                                                    encoding: null
                                                })
                                                .then((html5) => {
                                                    return fs.writeFileAsync(`${profilePath}\\Documents\\My Music\\Headspace\\Daily\\${filename}-10min.mp3`, html5.body)
                                                        .then(x => {

                                                            console.log(`File Written: ${filename}`);
                                                            // res.status(200).send(`File Written: ${filename}`);
                                                            return;
                                                        })
                                                })
                                        })
                                })
                        })
                })
        })

    today.add(1, 'days');
}
}

main();