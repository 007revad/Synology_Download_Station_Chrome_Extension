<h1><img src="images/Icon-128.png" alt="" style="width: 64px; height: 64px;" /> Synology Download Station Chrome Extension</h1>


<a href="https://github.com/007revad/Synology_Download_Station_Chrome_Extension/releases"><img src="https://img.shields.io/github/release/007revad/Synology_HDD_db.svg"></a>
[![Github Releases](https://img.shields.io/github/downloads/007revad/synology_download_station_chrome_Extension/total.svg)](https://github.com/007revad/Synology_Download_Station_Chrome_Extension/releases)
<a href="https://hits.seeyoufarm.com"><img src="https://hits.seeyoufarm.com/api/count/incr/badge.svg?url=https%3A%2F%2Fgithub.com%2F007revad%2FSynology_Download_Station_Chrome_Extension&count_bg=%2379C83D&title_bg=%23555555&icon=&icon_color=%23E7E7E7&title=views&edge_flat=false"/></a>
[![committers.top badge](https://user-badge.committers.top/australia/007revad.svg)](https://user-badge.committers.top/australia/007revad)


### Download Station Extension for Chrome Browser

Adapted from the original work done by LuukD
- https://www.download-station-extension.com/
- https://community.synology.com/enu/forum/1/post/35906

The Safari and Opera versions are [still available](https://www.download-station-extension.com/). But the Chrome extension is no longer available from the Google App Store.

The only changes I've made are to remove the analytics that virus scanners saw as a trojan, and updated the version number. 

<br>

**Note:** Chrome will show an error in chrome://extensions/ but it still works in April 2024.
- Manifest version 2 is deprecated, and support will be removed in 2023

I'm working on updating the extension to manifest v3... **July 2025 Update:** It was too hard to update to manifest v3.

<br>

### How to install the extension
1. Enter `chrome://flags` in chrome’s address bar and press Enter.
2. Search for `Allow legacy extension manifest versions`
    - 2025 update: See https://www.reddit.com/r/synology/comments/1c5tq2r/comment/nf5ofxw/
4. Enable it and click on the Relaunch button.
5. Download the latest [DownloadStation_Chrome_Extension.zip](https://github.com/007revad/Synology_Download_Station_Chrome_Extension/releases) file.
6. Unpack the DownloadStation_Chrome_Extension.zip archive. Remember the location of the "Synology_Download_Station" folder.
7. Open the Extensions page by either:
    - Type `chrome://extensions` in chrome's address bar, or
    - Click on the extensions icon > Manage Extensions, or
    - Use the menu: ⋮ > Extensions > Manage Extensions.
8. Enable "Developer Mode" on the top right.
9. Select "Load unpacked" option.
10. Find the unpacked extension's folder "Synology_Download_Station".
11. Open the folder.
12. That's it. You can find the extension on the chrome://extensions page.
