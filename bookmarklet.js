"use strict";
(function () {
    /* 
        Tested only in Chrome, ¯\_(ツ)_/¯
        Please feel free to port/fix/fork.
    */
    const ver = 'V.20161228.112502';
    const src = 'https://github.com/taengstagram/IG-Comments-Bookmarklet/';
    console.info(ver);
    console.info(src);

    let patt = /https?:\/\/www\.instagram\.com\/p\/([^\/]+)/i;
    let matches = patt.exec(document.location.href);
    if (!matches) {
        console.error('Unable to process page');
        return;
    }
    let shortCode = matches[1];
    let caption = null;
    let maxPages = 0;

    function getCookie(name) {
      let value = "; " + document.cookie;
      let parts = value.split("; " + name + "=");
      if (parts.length == 2) return parts.pop().split(";").shift();
    }

    function getCustomParam(name) {
        let params = (document.location.hash || document.location.search).replace('#', '&').replace('?', '&');
        let parts = params.split("&" + name + "=");
        if (parts.length == 2)
            return parts.pop().split("&").shift();
    }

    function generateParams(shortCode, cursor) {
        let params = "q=" + 
            encodeURIComponent(
                "ig_shortcode(" + shortCode + ") {comments.before(" + cursor + ", 1000) "
                + "{count, nodes {id, created_at, text, user {id, profile_pic_url, username, full_name}}, page_info}}");
        return params;
    }

    function generateDt(created_at) {
        if (typeof(moment) == 'undefined' || typeof(moment.tz) == 'undefined') {
            return new Date(created_at * 1000);
        }
        return moment.tz(created_at * 1000, "Asia/Seoul").format('YYYY-MM-DD h:mm:ssA [KST]');
    }

    function renderComments(nodes) {
        if (nodes.length == 0) {
            return;
        }
        nodes.sort(function(a, b) {
            // sort in asc datetime order
            if (a.created_at > b.created_at) {
                return 1;
            }
            if (a.created_at < b.created_at) {
                return -1;
            }
            return 0;
        });
        let parent = uiAnchor.parentNode.getElementsByTagName('ul')[0];
        let firstChild = parent.childNodes[0];
        let itemClassName = firstChild.className;
        let linkClassName = parent.childNodes[2].getElementsByTagName('a')[0].className;

        parent.innerHTML = '';
        if (firstChild.getElementsByTagName('h1').length > 0) {
            // has a caption so let's put it back
            firstChild.getElementsByTagName('h1')[0].getElementsByTagName('span')[0].innerHTML = renderEmoji(caption);
            parent.appendChild(firstChild);
            parent.appendChild(document.createElement("hr"));
        }

        for (let i = 0; i < nodes.length; i++) {
            let node = nodes[i];
            let container = document.createElement("li");
            container.classList.add(itemClassName);
            if (node.fromMention) {
                container.classList.add("mentioned");
            }
            container.innerHTML = '<a class="' + linkClassName + '" href="/' + node.user.username + '/">' + node.user.username + '</a> '
                + '<span>' + renderEmoji(node.text) + '</span>'
                + '<span data-comment-id="' + node.id + '" class="dt">' + generateDt(node.created_at) + '</span>';
            parent.appendChild(container);

            if (i == nodes.length - 1) {
                container.insertAdjacentHTML('afterend',
                    '<span class="fn"><a href="' + src + '">//source</a></span>');
            }
        }

    }

    function renderStatus(text) {
        let parent = uiAnchor.childNodes[0];
        parent.innerHTML = '<span class="st">' + text + '</span>';
    }

    function renderEmoji(text) {
        if (typeof(twemoji) == 'undefined') {
            return text;
        }
        return twemoji.parse(text);
    }

    let WANTED = ['329452045', '1678311178', '453462996', '363567749', '1497851591', '416573427', '1078607901', '2213235565', '1499879597'];
    let additional_ids = getCustomParam('wanted');    // let user specify additional user ids in the form of command sep IDs
    if (additional_ids) {
        WANTED = WANTED.concat(additional_ids.split(','));
    }

    let uiAnchor = document.getElementsByTagName('section')[1];

    let displayComments = [];
    let mentions = [];
    let mentionRegex = /@([a-z0-9_]+([\.][a-z0-9]+)?)/ig;

    let q = 1;

    function sendRequest(shortCode, cursor) {
        renderStatus('Loading... ' + q + '/' + maxPages);
        let xhr = new XMLHttpRequest();
        let params = generateParams(shortCode, cursor);
        xhr.open("POST", "https://www.instagram.com/query/", true);
        xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        xhr.setRequestHeader("x-csrftoken", getCookie('csrftoken'));
        xhr.onreadystatechange = function() { 
            if (xhr.readyState != 4) {
                return;
            }

            try {
                let info = JSON.parse(xhr.responseText);
                renderStatus('Processing... ' + q + '/' + maxPages);
                let comments = info.comments.nodes;
                comments.sort(function(a, b) {
                    // sort in desc datetime order
                    if (a.created_at > b.created_at) {
                        return -1;
                    }
                    if (a.created_at < b.created_at) {
                        return 1;
                    }
                    return 0;
                });
                for (let i = 0; i < comments.length; i++) {
                    if (WANTED.indexOf(comments[i].user.id) >= 0) {
                        displayComments.push(comments[i]);

                        // extract mention from comment
                        let matchesMention = null;
                        do {
                            matchesMention = mentionRegex.exec(comments[i].text);
                            if (matchesMention && mentions.indexOf(matchesMention[1]) < 0) {
                                mentions.push(matchesMention[1]);
                            }
                        } while (matchesMention);

                    } else {
                        let mentionFound = mentions.indexOf(comments[i].user.username);
                        if (mentionFound >= 0) {
                            let commentMentioned = comments[i];
                            commentMentioned.fromMention = true;
                            displayComments.push(commentMentioned);
                            mentions.splice(mentionFound, 1);   // remove from mentions once a match is found
                        }
                    }
                } 
                if (info.comments.page_info.has_previous_page) {
                    let cursor = info.comments.page_info.start_cursor;
                    if (maxPages <= 50) {
                        sendRequest(shortCode, cursor);
                    } else {
                        // Delay each request by X milliseconds if there are a lot of pages
                        // to avoid being throttled by IG
                        setTimeout(function() { sendRequest(shortCode, cursor); }, 2000);
                    }
                    return;
                }
                renderStatus('Done. ' + displayComments.length + ' comment(s) found.');
                renderComments(displayComments);
                
            } catch (err) {
                let count_text = ' ' + displayComments.length + ' comment(s) found.';
                if (xhr.status >= 500) {
                    renderStatus('Instagram Error: "' + xhr.responseText + '"' + count_text);
                } else if (xhr.status == 429) {
                    renderStatus('Too Many Requests: Please try again later.' + count_text);
                } else {
                    renderStatus('Unexpected error: ' + err + count_text);
                }
                renderComments(displayComments);
            }
        };
        q++;
        xhr.send(params);
    }

    if (typeof(twemoji) == 'undefined' || typeof(moment) == 'undefined' || typeof(moment.tz) == 'undefined') {  // inject if not available
        let head = document.getElementsByTagName('head')[0];
        let scripts = [
            'https://twemoji.maxcdn.com/2/twemoji.min.js?2.2.2'
            , 'https://unpkg.com/moment/min/moment.min.js'
            , 'https://unpkg.com/moment-timezone/builds/moment-timezone-with-data.min.js'
        ];
        for (let i = 0; i < scripts.length; i++) {
            let scriptCustom = document.createElement('script');
            scriptCustom.src = scripts[i];
            scriptCustom.async = false;
            head.appendChild(scriptCustom);
        }
        let styleCustom = document.createElement('style');
        styleCustom.innerHTML = 'img.emoji { height: 1em; width: 1em; margin: 0 .05em 0 .1em; vertical-align: -0.1em; } '
            + 'span.dt { color: #888; font-size: small; display: block; } .st { color: #1565c0; } '
            + '.fn a { color: #1565c0; font-size: x-small; }'
            + '.mentioned { opacity: 0.75; }';
        head.appendChild(styleCustom);
    }
    let xhr = new XMLHttpRequest()
    renderStatus('Loading...');
    xhr.open("GET", "https://www.instagram.com/p/" + shortCode + "/?__a=1", true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState != 4) {
            return;
        }
        let info = JSON.parse(xhr.responseText);
        if (WANTED.indexOf(info.media.owner.id) < 0) {
            WANTED.push(info.media.owner.id);
        }

        if (info.media.caption) {
            caption = info.media.caption;
            // extract mentions in caption
            let matchesMention = null;
            do {
                matchesMention = mentionRegex.exec(info.media.caption);
                if (matchesMention && mentions.indexOf(matchesMention[1]) < 0) {
                    mentions.push(matchesMention[1]);
                }
            } while (matchesMention);
        }
        if (info.media.usertags.nodes.length > 0) {
            // extract user tags as mentions
            for (let i = 0; i < info.media.usertags.nodes.length; i++) {
                let username = info.media.usertags.nodes[i].user.username;
                if (mentions.indexOf(username) < 0) {
                    mentions.push(username);
                }
            }
        }
        maxPages = Math.ceil(info.media.comments.count / 1000);
        sendRequest(info.media.code, '0');
    };
    xhr.send();
})();
