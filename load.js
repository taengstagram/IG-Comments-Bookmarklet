(function () {
    "use strict";

    const latest_file = 'https://raw.githubusercontent.com/taengstagram/IG-Comments-Bookmarklet/master/latest.txt';
    let xhr = new XMLHttpRequest();
    xhr.open("GET", latest_file, true);
    xhr.onreadystatechange = function() { 
        if (xhr.readyState != 4) {
            return;
        }
        let bookmarklet_src = xhr.responseText;
        let head = document.getElementsByTagName('head')[0];
        let scriptBookmarklet = document.createElement('script');
        scriptBookmarklet.src = bookmarklet_src;
        scriptBookmarklet.async = false;
        head.appendChild(scriptBookmarklet);
    };
    xhr.send();
})();
