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