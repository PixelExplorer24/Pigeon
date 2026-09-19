# Digital Pigeon — GitHub Pages

This package is prepared for deployment as a static site on GitHub Pages.

## Upload

Upload the **contents of this folder** to the root of your GitHub repository so that `index.html` is at the repository root.

## GitHub Pages

1. Open the repository on GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select branch **main** and folder **/(root)**.
5. Save and wait for GitHub Pages to publish the site.

## Firebase

The app uses Firebase Authentication and Firestore. Add the final GitHub Pages hostname to Firebase Authentication → Settings → Authorized domains.

## Mapbox

The app uses a public Mapbox access token. Configure URL restrictions for the final GitHub Pages hostname in the Mapbox account if restrictions are enabled.

## Notes

- `index.html` is the entry point.
- `assets/` contains the app CSS and JavaScript.
- `sw.js` provides same-origin static asset caching.
- `.nojekyll` prevents GitHub Pages/Jekyll processing.
- `404.html` provides a GitHub Pages fallback for direct navigation.
