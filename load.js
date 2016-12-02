(function () {
    "use strict";

    const latestFile = 'https://raw.githubusercontent.com/taengstagram/IG-Comments-Bookmarklet/master/latest.txt';
    let xhr = new XMLHttpRequest();
    xhr.open("GET", latestFile, true);
    xhr.onreadystatechange = function() { 
        if (xhr.readyState != 4) {
            return;
        }
        let bookmarkletSrc = xhr.responseText;
        let head = document.getElementsByTagName('head')[0];
        let scriptBookmarklet = document.createElement('script');
        scriptBookmarklet.src = bookmarkletSrc;
        scriptBookmarklet.async = false;
        head.appendChild(scriptBookmarklet);
    };
    xhr.send();
})();
