command_exists () {
    if [ -x "$(command -v $1)" ]; then
        return 0
    fi

    return 1
}

if ! command_exists 'node'; then
    echo "Command 'node' not found. Is NodeJS not installed?"
    exit
fi

if ! command_exists 'pm2'; then
    read -p "pm2 not installed. Install now? (y/n)? " choice
    case "$choice" in 
    y|Y ) npm i -g pm2;;
    esac
fi

pm2 start server.js