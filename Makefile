.SHELLARGS = -eu -c

DEFAULT_GOAL := help

.PHONY: help clean

help:
	@echo "help      - show this help"
	@echo "firefox   - build Firefox addon"
	@echo "safari    - build Safari extension"
	@echo "chrome    - build Chrome extension"
	@echo "all	   	 - build all"
	@echo "clean     - clean up dist directory"

firefox:
	@echo "Building Firefox addon"
	$(eval version=$(shell jq -r .version manifest.json))
	mkdir -p ./dist/firefox > /dev/null
	# cancel the last line of manifest.json
	cat manifest.json | tail -r | tail -n +2 | tail -r > manifest.json.tmp
	# append geckoid.manifest.json to manifest.json.tmp
	cat manifest.json.tmp geckoid.manifest.json > manifest.json.tmp2
	cp manifest.json manifest.json.tmp
	mv manifest.json.tmp2 manifest.json
	zip -r -FS ./dist/firefox/tpscanner-addon-$(version).xpi . --exclude "*.tmp" "geckoid.manifest.json"  "*.git*" "Makefile" "README.md" "PRIVACY.md" "dist/*" ".DS_Store" "images/.DS_Store" ".vscode/*" "store/*"
	zip -r -FS ./dist/firefox/tpscanner-addon-$(version)-sources.zip ./js/*
	mv manifest.json.tmp manifest.json

safari:
	@echo "Building Safari extension"
	$(eval version=$(shell jq -r .version manifest.json))
	$(eval PWD=$(shell pwd))
	mkdir -p $(PWD)/dist/safari > /dev/null
	mkdir -p $(PWD)/dist/safari/build > /dev/null
	mkdir -p $(PWD)/dist/safari/src > /dev/null
	mkdir -p $(PWD)/dist/safari/pkg > /dev/null
	cp -r html $(PWD)/dist/safari/src 
	cp manifest.json $(PWD)/dist/safari/src 
	cp -r images $(PWD)/dist/safari/src 
	cp -r js $(PWD)/dist/safari/src 
	cp -r css $(PWD)/dist/safari/src 
	xcrun safari-web-extension-converter $(PWD)/dist/safari/src --app-name "TPscanner" --bundle-identifier "dev.fcalefato.tpscanner" --project-location dist/safari --no-prompt --no-open --force --macos-only
	cd $(PWD)/dist/safari/TPscanner && xcodebuild -scheme TPscanner -archivePath dist/safari/build/TPscanner.xcarchive build
	cd $(PWD)/dist/safari/TPscanner && xcodebuild archive -scheme TPscanner -archivePath dist/safari/build/TPscanner.xcarchive
	# cd $(PWD)/dist/safari/TPscanner && xcodebuild -exportArchive -archivePath dist/safari/build/TPscanner.xcarchive -exportPath dist/safari/pkg/TPscanner.pkg -exportOptionsPlist ExportOptions.plist
	cd $(PWD)/dist/safari/TPscanner &&  xcodebuild -target TPscanner -configuration Release clean build
	cd $(PWD)/dist/safari/TPscanner &&  pkgbuild --root build/Release --identifier "dev.fcalefato.tpscanner" --version $(version) ../pkg/TPscanner-$(version).pkg

chrome:
	@echo "Building Chrome extension"
	$(eval version=$(shell jq -r .version manifest.json))
	mkdir -p ./dist/chrome > /dev/null
	zip -r -FS ./dist/chrome/tpscanner-$(version).zip . --exclude "*.git*" "Makefile" "README.md" "dist/*" ".DS_Store" ".vscode/*" "store/*" "images/.DS_Store"

clean:
	@echo "Cleaning up dist/ directory..."
	rm -rf ./dist/firefox
	rm -rf ./dist/safari
	rm -rf ./dist/chrome

all: chrome firefox safari
	