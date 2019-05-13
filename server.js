var Promise = require('bluebird');
var express = require('express');
var fs = Promise.promisifyAll(require('fs'));
var request = require('request'); //.defaults({jar: jar}));
const jar = request.jar()
request = Promise.promisifyAll(request.defaults({
    jar: jar
}));
var moment = require('moment');

var jwt;
var args = process.argv.slice(2);
var username = args[0];
var passwd = args[1];
var startDate = moment(args[3]).isValid(args[2]) ? moment(args[2]) : moment();
var endDate = moment(args[3]).isValid(args[3]) ? moment(args[3]) : moment();
var profilePath = process.env['USERPROFILE'];
var savePath = `${profilePath}\\Music\\Headspace\\Daily\\`
var ffmetadata = require("ffmetadata");

console.log(username);
console.log(passwd);

console.log(profilePath);
fs.mkdirSync(savePath, {
    recursive: true
});

async function main() {

    console.log(startDate.format());
    console.log(endDate.format());

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
                        .then(async (html2) => {
                            // console.log(html2);
                            var userInfo = JSON.parse(html2.toJSON().body);
                            // console.log(userInfo);
                            var userId = userInfo.included.find(x => x.type === 'users').attributes.userId;
                            // console.log(userId);
                            // res.status(200).send(userInfo);
                            while (endDate.isSameOrAfter(startDate)) {
                                await request.getAsync(`https://api.prod.headspace.com/content/view-models/everyday-headspace-banner?date=${startDate.format('YYYY-MM-DD')}&userId=${userId}`, {
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
                                        var suffix = `-10min.mp3`
                                        // console.log(tenMinuteMedia);
                                        // res.status(200).send(todaysInfo);
                                        fs.access(`${savePath}${filename}${suffix}`, fs.constants.F_OK, (err) => {
                                            if (err) {
                                                return request.getAsync(`https://api.prod.headspace.com/content/media-items/${tenMinuteId}/make-signed-url?mp3=true`, {
                                                        auth: {
                                                            bearer: jwt
                                                        }
                                                    })
                                                    .then(async (html4) => {
                                                        // console.log(html4);
                                                        var url = JSON.parse(html4.toJSON().body).url;
                                                        // console.log(url)
                                                        // res.status(200).send(html4.body);
                                                        await request.getAsync(url, {
                                                                auth: {
                                                                    bearer: jwt
                                                                },
                                                                timeout: 600000,
                                                                encoding: null
                                                            })
                                                            .then((html5) => {
                                                                return fs.writeFileAsync(`${savePath}${filename}${suffix}`, html5.body)
                                                                    .then(x => {

                                                                        console.log(`File Written: ${savePath}${filename}`);
                                                                        // res.status(200).send(`File Written: ${filename}`);
                                                                        return;
                                                                    })
                                                            })
                                                    })

                                            }
                                            setMetadata(savePath, filename, suffix, startDate)
                                            return;
                                        })
                                    })
                                startDate.add(1, 'days');
                            }
                            return;
                        })
                })
        })

}

function setMetadata(path, filename, suffix, date) {
    var data = {
        artist: 'Andy Puddicome',
        performer: 'Andy Puddicome',
        title: filename.replace(/-/gi, ' '),
        publisher: 'Headspace',
        genre: 'Meditation',
        date: date.format('YYYY-MM-DD'),
        comments: `Daily meditation for ${date.format('YYYY-MM-DD')}`,
        comment: `Daily meditation for ${date.format('YYYY-MM-DD')}`,
        album: `Daily meditation for ${date.format('YYYY-MM-DD')}`,
    };
    var options = {
        'id3v2.3': true
    }

    ffmetadata.write(`${path}${filename}${suffix}`, data, options, function (err) {
        if (err) console.error("Error writing metadata", err);
        else console.log("Data written");
    });
}

main();