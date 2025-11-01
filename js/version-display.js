//const checkVersionDisplay = setInterval(() => {
//    const versionSpan = document.getElementById('about-latest-version');
//    if (versionSpan && versionSpan.textContent.trim()) {
//        versionSpan.parentElement.style.display = 'block';
//        clearInterval(checkVersionDisplay);
//    } else {
//        versionSpan.parentElement.style.display = 'none';
//    }
//}, 100);

// Hide by default until version is fetched
document.getElementById('about-latest-version').parentElement.style.display = 'none';