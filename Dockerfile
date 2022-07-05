FROM ubuntu:22.04

ENV HOME=/home/animl
WORKDIR $HOME
COPY ./ $HOME/

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y curl git

RUN export NODEV='16.14.2' \
    && curl "https://nodejs.org/dist/v${NODEV}/node-v${NODEV}-linux-x64.tar.gz" | tar -xzv \
    && cp ./node-v${NODEV}-linux-x64/bin/node /usr/bin/ \
    && ./node-v${NODEV}-linux-x64/bin/npm install -g npm

RUN npm install

CMD npm test

