## Initialize Git and Commit
    git init
    git add .
    git commit -m "Initial commit: Hospital Management System"


## Set the main branch name
    git branch -M main

## Add the remote repository URL
    git remote add origin https://github.com/ceo-uploads/HMS.git

## Push your code and set upstream
    git push -u origin main

## If says - remote origin already exists
    git remote set-url origin https://github.com/ceo-uploads/HMS.git
    git push -u origin main

## Pull and merge remote changes
    git pull origin main --allow-unrealated-histories
    git push -u origin main

## Force overwrite the remote repository
    git push -u origin main --force


## Addin Version Control System Commands
    $secret = Read-Host "GitHub token" -AsSecureString
    $env:GH_TOKEN = [System.Net.NetworkCredential]::new("", $secret).Password
    try {
        npm run publish
    } finally {
        Remove-Item Env:GH_TOKEN -ErrorAction SilentlyContinue
        Remove-Variable secret -ErrorAction SilentlyContinue
    }


## VCS tags
    git push origin main --follow-tags
    npm run publish

## VCS status and push version
    git status
    npm version patch
    git push origin main --follow-tags

## Publish Fix Command
    git add main.cjs package.json package-lock.json scripts/ensure-update-metadata.cjs
    git commit -m "Fix GitHub updater metadata"
    git tag v1.0.2
    git push origin main --follow-tags  