# Changelog

### 4.0.17 - by 007revad
- Increased timeout from 20 to 30 seconds for DownloadStation API requests.
- Bug fix for AJAX Timeout/Abort errors.
- Bug fix for not reconnecting to DownloadStation if disconnected.
- Other bug fixes.
- Added my-other-scripts.md to "Options > Other Settings".

### 4.0.16 - by 007revad
- Updated to Chrome manifest 3.
- Changed to show the 100 newest downloads (instead of the 100 oldest in the previous versions).
- Changed progressbar for finished downloads to grey.
- Added check if newer version available (runs when extension loaded and once every 24 hours).
- Shows in options if there's a newer available from GitHub and provides a link to it.
- Added buymecoffee and PayPal donate buttons for those who want to support me.

### 3.0.15 - by 007revad
- Moved Icon-xx.png images to images folder

### 3.0.14 - by 007revad
- Removed Google Analytics that 15 out 65 virus scanners flagged as a Trojan

### 2.2.13
- Resolved JavaScript error in SVG documents
- Removed social media buttons from options page
- Internal changes for compatibility with future browser versions
- Improved error handling when signing in with an account without Download Station permissions

### 2.2.12
- Resolved an issue causing JavaScript errors in the Chrome developer tools.
- Improved device name detection
- Small bugfixes

### 2.2.11
- Session conflicts with the extension and DSM 6.0 have been resolved. You can now use a different user in DSM without being signed out by the extension.
- Bugfixes

### 2.2.10
- DSM 6.0 beta 2 compatibility
- Fixed a Safari issue where the extension could open links to websites or the settings page in an existing pinned tab instead of a new tab

### 2.2.9
- Improved compatibility with the Synology Router (RT1900AC)
- Safari extension signed with a new certificate

### 2.2.8
- Improved error handling when the user doesn't have permissions for the Download Station package
- Added changelog to the settings page
- Prevent Safari from showing a message about unsaved changes when the settings page is closed
- Opening the Download Station web interface now also works with DSM 6.0
- Removing downloads and clearing all finished downloads now works with DSM 6.0

### 2.2.7
- Fixed an issue with user accounts that do not have File Station permissions. The issue caused a "Permission denied" error after opening the "Download advanced" dialog. File Station permissions are required if you want to select a destination folder.
- Other small bugfixes

### 2.2.6
- Removed YouTube video and playlist download buttons to comply with Chrome Web Store policies.
- Improved compatibility with rutracker

### 2.2.5
- Fixed an issue that caused the selected destination folder to be ignored when adding a .torrent or .nzb file.

### 2.2.4
- Added error message for time-outs
- Fixed disappearing settings button in popover in Safari 7 (this was caused by a bug in Safari)

### 2.2.3
- Fixed an issue where the option page became unresponsive when testing/saving connection settings that do not point to a Synology device

### 2.2.2
- Improved DSM version detection for DSM 3.0 - 4.1
- Better error message for unsupported DSM versions
- Added message to settings page about the supported DSM versions

### 2.2.1
- Changes to comply with Opera store

### 2.2.0
- Dropped support for DSM version 4.1 and older.
- The extension now uses DSM's encryption API to encrypt your username and password when logging in. This also applies when you use the extension without SSL (HTTPS).
- The extension will not wake your DiskStation anymore if you disable background status updates. The extension will appear as disconnected after 30 seconds of inactivity.
- Select a destination folder for your download when using the "advanced" option in the context menu.
- Create new folders on your DiskStation (when selecting a destination folder)
- You can now see the ETA for downloads, based on the current download speed and progress
- Background refresh settings moved to the "Connection" tab of the settings page
- New icon and updated design (Bootstrap 3)
- Show the notification for finished torrents after downloading has finished (not after seeding)
- Improved support for torrent URL's that have GET-parameters
- Added Japanese, Slovak and Ukrainian translations
- Fixed an issue where the YouTube button could disappear when navigating between pages on YouTube.
- Fixed an issue that could cause the finished downloads counter to remain visible after the connection to the device was lost.

### 2.1.8
- YouTube download button updated for new YouTube layout
- The extension can now handle download URL's containing a comma

### 2.1.7
- Fixed an issue where in certain cases the finished tasks counter would not be removed from the toolbar button when the connection to the device is lost.
- Improved compatibility with Chrome 38 (keep in mind that the extension may not work properly in pre-release versions of Chrome, use the stable version of Chrome for best compatibility)

### 2.1.6
- Fixed desktop notifications for recent Chrome versions

### 2.1.5
- Replaced Serbian translation with a translation in the cyrillic alphabet
- Fixed small interface bug when the pop-up contains 100 downloads
- Fixed an issue that could cause the dialog from opening behind website content on some websites
- Removed Flattr button from settings page
- Added Reddit sharing button to settings page

### 2.1.4
- Fixed YouTube button for videos with an ID that start with a "-"
- Added Finnish, Slovak and Serbian translation
- Updated the existing translations

### 2.1.3
- Fixed disappearing YouTube button
- Added error message "No destination folder set"
- Show "download finished" notification based on download percentage instead of task status "finished"

### 2.1.2
- Improved DSM 5.0 beta support

### 2.1.1
- Support for the latest DSM 4.3 update

### 2.1.0
- Advanced downloading dialog
	- HTTP/FTP username and password
	- Unzip password
	- Preview of URL's that will be submitted (especially useful when adding multiple links from a selection)
- Fixed an issue that could cause the download button on YouTube to disappear when switching to another video
- Limit the maximum number of visible downloads to 100 to reduce performance impact
- New translations: Arabic, Czech, Indonesian, Korean, Portuguese, Turkish
- Updated the other translations

### 2.0.5
- Fixed an issue that could cause the extensions session to be shared with the users browser session

### 2.0.4
- Correctly determine DSM version number for DSM 4.3
- Added a link to the FAQ-page to the settings page
- Added Brazilian, Chinese and Taiwanese translations
- Updated Danish, Norwegian, Dutch, Russian and Swedish translations

### 2.0.3
- Added Danish, German, Hungarian, Norwegian, Polish, Russian, Spanish and Swedish translation
- Dropped support for settings sync in Chrome because many users like to have different settings on their devices
- Password field on settings page not required
- Better naming of uploaded torrents/nzb's that don't have a correct filename in their URL (/download.php?id=1)
- Show correct icon in Safari toolbar when opening a new window
- Fix for "Adding task" message not disappearing when adding torrent/nzb task
- Fixed sorting of tasks (sorted by date added)
- Small performance/efficiency improvements

### 2.0.2
- Bug fixes for old Chrome versions

### 2.0.1
- Fix for saving settings in older Chrome versions

### 2.0
- Support for the official Download Station API
- Fallback to the Download Redirector API for old devices (DSM < 4.2)
- Redesigned pop-up
- Google Chrome: Settings are synced with your Google account
- Safari: Settings are stored in the secure storage space for extensions
- Pop-up shows the progress of seeding torrents (share ratio)
- Confirm deletion of download tasks
- Buttons to pause/resume all tasks
- The pop-up shows the name of your DiskStation
- Torrents and NZB files are uploaded directly to Download Station
- Toolbar icon indicates if the extension is connected to Download Station
- Download button for YouTube playlists (DSM 4.2 and newer)
- Full support for magnet torrents (DSM 4.2 and newer)
- Magnet, Thunder, QQDL and Emule links are opened with the extension by default (you can change this behaviour in your settings)
- Contextmenu-item will be disabled (Chrome) or hidden (Safari) if the extension is not connected to Download Station
- Added license information to settings page
- Removed the in-page buttons from the Piratebay and Isohunt because magnet links can now be opened with the extension
- Total download/upload speed in the pop-up
- Italian translation

### 1.6.2
- Support for DSM 4.2 beta
- Icon in YouTube button

### 1.6.1
- Fixed the YouTube download button for the new YouTube website
- Added status text for "unpacking" (status 10)

### 1.6.0
- French translation (Thanks to 'secretliar' from the Synology forum!)
- Updated to Chrome Extension manifest version 2
- Fixed a bug that caused all connection tests to fail for usernames that contain a space
- Other minor bug fixes and styling fixes for the new French translation

### 1.5.8
- Private tracker support for Safari 6
- Updated to remove usage of old and deprecated API's

### 1.5.7
- Added missing status message
- Minor translation and bug fixes

### 1.5.6
- Improved support for torrents from The Piratebay

### 1.5.5
- Fixed missing icon in Chrome desktop notifications

### 1.5.4
- Download button on isoHunt.com
- Hide tasks immediately when removing or clearing
- New toolbar icon for Safari
- Last version with support for Chrome 17 and older, update if you are still using an old version!
- Dutch translation for the settings page

### 1.5.3
- Tested with DSM 4.1 beta
- Notification Center support for OS X 10.8 Mountain Lion
- Fixed missing icon in notifications in Safari on OS X 10.7 and older

### 1.5.2
- Added Torcache.net as source for torrent files for magnet links
- Fixed a bug that caused every failed task to show the same error message in stead of more specific errors

### 1.5.0 & 1.5.1
- More responsive status pop-up
- Animations in pop-up (progress bar, adding/removing tasks)
- Smoother adjustment of the pop-up height in Safari when adding/removing tasks
- Updated the Piratebay button for changes on their site
- Visual feedback when a tasks is being submitted to Download Station
- More detailed error messages when a task can't be added
- New option to disable uploading of torrents to a temporary location (disabling will disable support for private trackers)
- Minor bug fixes

### 1.4.6
- Fix for problems with torrent URL's that contain parameters

### 1.4.5
- Support for private torrent sites! The extension will upload the torrent to a temporary location from where Download Station grabs the torrent file. Uploads are deleted after 10 minutes from the temporary location.
- More efficient communication with Download Station.

### 1.4.4
- Added a button to the options page to test your settings
- Hiding YouTube download button if you have a DSM version older than 3.2
- Minor bugfixes

### 1.4.3
- Added support for multiple links
- Updated icons
- Fixed an issue that could cause the pop-up to become unresponsive in Safari

### 1.4.2
- Added partial magnet support using zoink.it.

### 1.4.0
- Bug fixes

### 1.3.0
- Fixed button on thepiratebay.org
- Added button on MegaUpload download page
