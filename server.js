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

console.log(username);
console.log(passwd);


request.getAsync('https://www.headspace.com/login/check')
    .then((x) => {
        // console.log(x);
        request.postAsync('https://www.headspace.com/login/check', {
                formData: {
                    _username: username,
                    _password: passwd
                }
            })
            .then((html) => {
                // console.log(html);
                var cookies = html.headers['set-cookie']
                console.log(cookies);
                jwt = cookies.find(x => x.startsWith('hsngjwt=')).split(';')[0].split('=')[1];
                console.log(jwt);
                // res.status(200).send('OK');
                request.postAsync('https://api.prod.headspace.com/auth/tokens/email', {
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
                        console.log(userId);
                        // res.status(200).send(userInfo);
                        request.getAsync(`https://api.prod.headspace.com/content/view-models/everyday-headspace-banner?date=${moment().format('YYYY-MM-DD')}&userId=${userId}`, {
                                auth: {
                                    bearer: jwt
                                }
                            })
                            .then((html3) => {
                                console.log(html3);
                                var todaysInfo = JSON.parse(html3.toJSON().body);
                                console.log(todaysInfo);
                                var filename = todaysInfo.data.attributes.titleText.replace(/\s/gi, '-');
                                console.log(filename);
                                var tenMinuteId = todaysInfo.included.find(x => x.attributes.duration === 10).relationships.mediaItem.data.id;
                                console.log(tenMinuteId);
                                var tenMinuteMedia = todaysInfo.included.find(x => x.id === tenMinuteId);
                                console.log(tenMinuteMedia);
                                // res.status(200).send(todaysInfo);
                                request.getAsync(`https://api.prod.headspace.com/content/media-items/${tenMinuteId}/make-signed-url?mp3=true`, {
                                        auth: {
                                            bearer: jwt
                                        }
                                    })
                                    .then((html4) => {
                                        console.log(html4);
                                        var url = JSON.parse(html4.toJSON().body).url;
                                        console.log(url)
                                        // res.status(200).send(html4.body);
                                        request.getAsync(url, {
                                                auth: {
                                                    bearer: jwt
                                                },
                                                timeout: 600000,
                                                encoding: null
                                            })
                                            .then((html5) => {
                                                fs.writeFileAsync(`C:\\Users\\dcan\\Documents\\My Music\\Headspace\\Daily\\${filename}-10min.mp3`, html5.body)
                                                    .then(x => {

                                                        console.log('done');
                                                        // res.status(200).send(`File Written: ${filename}`);
                                                    })
                                            })
                                    })
                            })
                    })
            })
    })