# firebase-oauth-lite

Lightweight Firebase OAuth Library 

## Getting Started

### Prerequisites

Firebase authentication providers must be set using [firebase console](https://console.firebase.google.com).

### Installing

```
npm install firebase-oauth-lite
```
### Using
Initialize

```
import Auth from 'firebase-oauth-lite';

const firebaseConfig = {
    apiKey: "<API_KEY>",
    redirectURL: '<REDIRECT_URL>',
    providers: ['google.com', 'facebook.com', 'twitter.com', 'github.com']
};

const FirebaseAuth = new Auth(firebaseConfig);

export default FirebaseAuth;
```

Sign-in

```
FirebaseAuth.signInWithProvider('google.com');
```

Handle OAuth Redirects

```
FirebaseAuth.handlePostSignInRedirect();
```

Listen to auth state changes

```
this.unregisterAuthListener = FirebaseAuth.addListener((user) => {
    ...
});
```

Sign-out

```
FirebaseAuth.signOut();
```

## Versioning

For the versions available, see the [tags on this repository](https://github.com/vivekweb2013/firebase-oauth-lite/tags). 

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details
