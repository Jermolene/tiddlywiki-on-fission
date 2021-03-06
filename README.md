# TiddlyWiki on Fission

This tool lets you directly edit [TiddlyWiki](https://tiddlywiki.com/) files stored in [Fission](https://fission.codes)'s Webnative file system. You can choose to make them publicly accessible or to keep them entirely private. End-to-end encryption is used so even Fission can't read private data stored on their servers.

This is a very early proof of concept release, and is not yet in a state where you should trust it with important data.

Try it out at https://tiddlywiki.fission.app/

![image](https://user-images.githubusercontent.com/174761/110135283-391b0200-7dc6-11eb-9394-fd5ad35cb4d7.png)


## Backers

We're using [Open Collective](https://opencollective.com/tiddlywiki-on-fission) to further support development on this project.

Thank you to all of our backers!

[![](https://opencollective.com/tiddlywiki-on-fission/tiers/backer.svg?avatarHeight=36&width=600)](https://opencollective.com/tiddlywiki-on-fission)

Join the [Fission forum for further TiddlyWiki on Fission discussion »](https://talk.fission.codes/c/apps/tiddlywiki/57)

# Development Setup

Clone this repository and install its dependencies:

```
npm install
```

To install subsequent upstream changes from TiddlyWiki 5:

```
npm update
```


## Develop

To run the app locally:

```
npm start
```

## Build

To build the app:

```
npm run build
```

The output files will be in `wiki/output`.

