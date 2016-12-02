(function () {
    "use strict";
    /* 
        Tested only in Chrome, ¯\_(ツ)_/¯
        Please feel free to port/fix/fork.
    */
    const ver = 'V.20161202.145810';
    const src = 'https://gist.github.com/taengstagram/91c858cdcd5ecb0d1679fd5d5e20aba0';
    console.log(ver);
    console.log(src);

    let shortCode = false;

    if (typeof(window._sharedData) == 'undefined' ||
        typeof(window._sharedData.entry_data.PostPage) == 'undefined' ||
        typeof(window._sharedData.entry_data.PostPage[0].media) == "undefined") {
        
        let patt = /https?:\/\/www\.instagram\.com\/p\/([^\/]+)/i;
        let matches = patt.exec(document.location.href);
        if (matches) {
            shortCode = matches[1];
        }
    } else {
        shortCode = window._sharedData.entry_data.PostPage[0].media.code;
    }

    if (!shortCode) {
        console.error('Unable to process page');
        return;
    }

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
            parent.appendChild(firstChild);
            parent.appendChild(document.createElement("hr"));
        }

        for (let i = 0; i < nodes.length; i++) {
            let node = nodes[i];
            let container = document.createElement("li");
            container.classList.add(itemClassName);
            container.innerHTML = '<a class="' + linkClassName + '" href="/' + node.user.username + '/">' + node.user.username + '</a> '
                + '<span>' + renderEmoji(node.text) + '</span>'
                + '<span class="dt">' + generateDt(node.created_at) + '</span>';
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

    let q = 0;

    function sendRequest(shortCode, cursor) {
        renderStatus('Loading... ' + q);
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
                renderStatus('Processing... ' + q);
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

                        let matchesMention = null;
                        do {
                            matchesMention = mentionRegex.exec(comments[i].text);
                            if (matchesMention) {
                                mentions.push(matchesMention[1]);
                            }
                        } while (matchesMention);


                    } else {
                        let mentionFound = mentions.indexOf(comments[i].user.username);
                        if (mentionFound >= 0) {
                            displayComments.push(comments[i]);
                            mentions.splice(mentionFound, 1);   // remove from mentions once a match is found
                        }
                    }
                } 
                if (info.comments.page_info.has_previous_page && q <= 50) {
                    let cursor = info.comments.page_info.start_cursor;
                    sendRequest(shortCode, cursor);
                    return;
                }
                renderStatus('Done. ' + displayComments.length + ' comment(s) found.');
                if (mentions.length > 0) {
                    for (let i = 0; i < mentions.length; i++) {
                        let mentioned_user = mentions[i].mentioned_user;

                    }
                }
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
            return;
        };
        q++;
        xhr.send(params);
    }

    if (typeof(twemoji) == 'undefined' || typeof(moment) == 'undefined' || typeof(moment.tz) == 'undefined') {  // inject if not available
        let head = document.getElementsByTagName('head')[0];
        let scripts = ['https://twemoji.maxcdn.com/2/twemoji.min.js?2.2.2', 'https://unpkg.com/moment/min/moment.min.js', 'https://unpkg.com/moment-timezone/builds/moment-timezone-with-data.min.js'];
        for (let i = 0; i < scripts.length; i++) {
            let scriptCustom = document.createElement('script');
            scriptCustom.src = scripts[i];
            scriptCustom.async = false;
            head.appendChild(scriptCustom);
        }
        let styleCustom = document.createElement('style');
        styleCustom.innerHTML = 'img.emoji { height: 1em; width: 1em; margin: 0 .05em 0 .1em; vertical-align: -0.1em; } '
            + 'span.dt { color: #888; font-size: small; display: block; } .st { color: #1565c0; } .fn a { color: #1565c0; font-size: x-small; }';
        head.appendChild(styleCustom);
    }
    sendRequest(shortCode, '0');
})();
