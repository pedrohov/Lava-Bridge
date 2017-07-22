var HeroStick = HeroStick || {};

HeroStick.GameState = {
    
    init: function(counter, time, maxScore) {

        // Adapt screen size to fit the game:
        this.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
        this.scale.pageAlignHorizontally = true;
        this.scale.pageAlignVertically = true;
        
        // Enable physics:
        this.game.physics.startSystem(Phaser.Physics.ARCADE);
        
        // Constants:
        this.PLATFORM_HEIGHT = 80;
        this.PLATFORM_MIN_WIDTH = 64;
        this.PLAYER_WIDTH = 12;
        this.PLAYER_HEIGHT = 32;
        this.BRIDGE_SPEED = 0.2; // 0 ~ 1
        
        this.DAY_DURATION = 7;
        this.NIGHT_DURATION = 4;
        
        this.PLATFORM_COLOR = 0x1C2626;
        this.PLAYER_COLOR = 0x29302B; // 0x29302B 0x1C2626
        this.BRIDGE_COLOR = 0x1C2626;
        
        this.timeCounter = counter || 0;
        this.time = time || 'day';
        this.maxScore = maxScore || 0;
        
    },
    
    preload: function() {
        
        // Load assets:
        this.game.load.bitmapFont('carrierCommand', 'assets/fonts/carrier_command.png', 'assets/fonts/carrier_command.xml');
        this.game.load.image('night', 'assets/images/night.png');
        this.game.load.image('day', 'assets/images/day.png');
        this.game.load.image('audio', 'assets/images/music.png');
        this.game.load.image('about', 'assets/images/about.png');
        this.game.load.spritesheet('particle', 'assets/images/particle.png', 20, 20);
        this.game.load.audio('darkcity', ['assets/audio/Dark City.mp3', 'assets/audio/Dark City.ogg']);

    },
    
    create: function() {
        
        // Draw background:
        this.background = this.game.add.image(0, 0, this.time);
        this.bgMusic = this.game.add.audio('darkcity');
        this.bgMusic.play();
        
        // Draw music icon:
        this.audio = this.game.add.image(this.game.world.width - 40, 20, 'audio');
        this.audio.scale.setTo(0.5);
        this.audio.inputEnabled = true;
        this.audio.events.onInputDown.add(this.toggleMusic, this);
        
        // About menu:
        this.menu = this.createMenu();
        this.menu.visible = false;
        
        // Draw about icon:
        this.about = this.game.add.image(this.game.world.width - 40, 50, 'about');
        this.about.scale.setTo(0.5);
        this.about.inputEnabled = true;
        this.about.events.onInputDown.add(this.toggleMenu, this);
        
        // Create initial platform:
        this.platform = this.game.add.graphics(0, this.game.world.height - this.PLATFORM_HEIGHT);
        this.platform.beginFill(this.PLATFORM_COLOR);
        this.platform.drawRect(0, 0, this.PLATFORM_MIN_WIDTH, this.PLATFORM_HEIGHT);
        this.platform.endFill();
        
        this.game.physics.arcade.enable(this.platform);
        this.platform.body.immovable = true;
        
        // Player:
        this.player = this.game.add.graphics(this.PLATFORM_MIN_WIDTH / 2 - this.PLAYER_WIDTH / 2, this.game.world.height - this.PLATFORM_HEIGHT - this.PLAYER_HEIGHT);
        this.player.beginFill(this.PLAYER_COLOR);
        this.player.drawRect(0, 0, this.PLAYER_WIDTH, this.PLAYER_HEIGHT);
        this.player.endFill();
        this.game.physics.arcade.enable(this.player);
        
        // Create a random platform:
        this.nextPlatform = this.generateNext();
        
        // Bridge:
        this.bridge = undefined;
        
        // Drop the bridge when the mouse is released:
        this.game.input.onUp.add(this.dropBridge, this);
        
        // UI and animation control:
        this.bridgeInteraction = false;
        this.menuInteraction = false;
        this.gameOver = false;
        
        // Player score:
        this.score = 0;
        this.scoreText = this.game.add.bitmapText(this.game.world.width / 2, 30, 'carrierCommand', 'SCORE: ' + this.score, 12);
        this.scoreText.anchor.setTo(0.5);
        
        // Particles:
        this.emitter = this.game.add.emitter(this.game.world.centerX, this.game.world.height, 100);
        this.emitter.width = this.game.world.width;
        this.emitter.makeParticles('particle');
        this.emitter.minParticleScale = 0.08;
        this.emitter.maxParticleScale = 0.3;
        this.emitter.setYSpeed(-10, -100);
        this.emitter.setXSpeed(-50, 50);
        this.emitter.minRotation = 0;
        this.emitter.maxRotation = 0;
        this.emitter.start(false, 1600, 5, 0);
        
        // Time events:
        // Free player input after clicking on a button:
        this.resetControls = this.game.time.create(false);
        this.resetControls.loop(1000, this.freeControls, this);
        this.resetControls.start();
        
    },
    
    update: function() {
        
        // Mouse and touch input:
        if(this.gameOver && this.game.input.activePointer.isDown)
            this.game.state.restart(true, false, this.timeCounter, this.background.key, this.maxScore);
        
        // Build the bridge while the pointer is down:
        if(this.game.input.activePointer.isDown && !this.bridgeInteraction && !this.menuInteraction)
        {
            if(this.bridge !== undefined)
                this.bridge.destroy();
            
            this.bridge = this.createBridge();
        } 
    },
    
    dropBridge: function() {
        
        // If there is no bridge or there is animation playing, do nothing:
        if(this.bridge === undefined || this.bridgeInteraction)
            return;
        
        // Make the bridge fall:
        this.bridgeInteraction = true;
        var drop = this.game.add.tween(this.bridge).to({angle: '+90'}, 300, Phaser.Easing.Linear.None, true);
        
        // Move the player:
        drop.onComplete.add(function() {
            
            //this.player.animations.play('walking');
            
            var playerMove = this.game.add.tween(this.player).to({x: this.bridge.body.x + this.bridge.body.height}, 800, Phaser.Easing.Linear.None, true);
            
            playerMove.onComplete.add(function() {     
                // If the player successfully reaches the next platform:
                if(this.success())
                {
                    // Destroi the bridge:
                    this.bridge.destroy();
                    this.bridge = undefined;

                    // Update the score:
                    this.score += 1;
                    this.scoreText.setText("SCORE: " + this.score);
                    if(this.score > this.maxScore)
                            this.maxScore = this.score;

                    // Bring the player and the platform to the left:
                    this.game.add.tween(this.player).to({x: this.PLATFORM_MIN_WIDTH / 2 - this.PLAYER_WIDTH / 2}, 400, Phaser.Easing.Linear.None, true);
                    var move = this.game.add.tween(this.nextPlatform).to({x: 62-(this.nextPlatform.body.x + this.nextPlatform.body.width)}, 400, Phaser.Easing.Linear.None, true);

                    move.onComplete.add(function() {
                    
                        // Generate the next platform:
                        this.nextPlatform.destroy();
                        this.nextPlatform = undefined;
                        this.nextPlatform = this.generateNext();

                        this.bridgeInteraction = false;
                        
                        this.timeCounter++;
                        this.background.loadTexture(this.dayOrNight());

                    }, this);
                }
                // If the player fell:
                else
                {
                    // Block controls:
                    this.bridgeInteraction = true;

                    // Play animations:
                    var playerFalling = this.game.add.tween(this.player).to({y: this.game.world.height, x: '+60', angle: '+45'}, 500, Phaser.Easing.Linear.None, true);
                    
                    // Restart the game:
                    playerFalling.onComplete.add(function() {
                        this.bgMusic.stop();
                        this.showScores();
                        this.gameOver = true;
                    }, this);
                }
                
            }, this); // End of player tween.
        }, this); // End of bridge tween.
        
    },
    
    createBridge: function() {
        
        // Get input down duration:
        var duration = this.game.input.activePointer.duration;
        
        // Draw a new bridge:
        var bridge = this.game.add.graphics(this.PLATFORM_MIN_WIDTH - 5, this.game.world.height - this.PLATFORM_HEIGHT);
        bridge.beginFill(this.BRIDGE_COLOR);
        bridge.drawRect(0, 0, 5, -(duration * this.BRIDGE_SPEED));
        bridge.endFill();
        
        // Enable physics on it:
        this.game.physics.arcade.enable(bridge);
        bridge.anchor.setTo(1, 1);
        bridge.body.immovable = true;
        
        return bridge;
    },
    
    generateNext: function() {
        
        var minWidth = 30;
        var maxWidth = this.game.world.width / 3;
        
        // Make platforms slightly smaller when it is night:
        if(this.background.key == 'night')
        {
            minWidth = this.player.body.width;
            maxWidth = this.game.world.width / 5;
        }
        
        var pWidth = Math.floor(Math.random() * maxWidth + minWidth);
        
        var maxDist = this.game.world.width - (pWidth);
        var minDist = this.PLATFORM_MIN_WIDTH + 30;
        
        var pStart = Math.floor(Math.random() * (maxDist - minDist) + minDist);
        
        // Draw the platform and give it a physics body:
        var ledge = this.game.add.graphics(pStart, this.game.world.height - this.PLATFORM_HEIGHT);
        ledge.beginFill(this.PLATFORM_COLOR);
        ledge.drawRect(0, 0, pWidth, this.PLATFORM_HEIGHT);
        ledge.endFill();
        this.game.physics.arcade.enable(ledge);
        ledge.body.immovable = true;
        
        return ledge;
    },
    
    success: function() {
        
        
        if((this.player.body.x + this.player.body.width) > (this.nextPlatform.body.x + this.nextPlatform.body.width))
            return false;
        else if((this.player.body.x + this.player.body.width) > this.nextPlatform.body.x)
            return true;
           
        return false;
    },
    
    drawBackground: function() {
        
        // Draws a custom background (NOT USED):
        this.game.stage.backgroundColor = '#394130'; // #29302B 394130
        
        var nSquaresH = this.game.world.width / 8;
        var spacingH = 1;
        var dot = this.game.add.graphics(0, 0);
        dot.beginFill('0x4e5546');
        
        
        for(var j = 0; j < 1024; j += 8)
        {
            var totalSpacingH = 0;
            for(var i = 0; i < nSquaresH * 8; i += 8)
            {
                dot.drawRect(i + totalSpacingH, j, 8, 8);
                totalSpacingH += spacingH;
            }
            
            spacingH += 1;
        }
        
        dot.endFill();
    },
    
    dayOrNight: function() {

        if(this.timeCounter == this.DAY_DURATION && this.background.key == 'day')
        {
            this.timeCounter = 0;
            return 'night';
        }
        else if(this.timeCounter == this.NIGHT_DURATION && this.background.key == 'night')
        {
            this.timeCounter = 0;
            return 'day';
        }
        else return this.background.key;
    },
    
    createTSound: function() {

        // Draws a button to toggle background music:
        var button = this.game.add.graphics(this.game.world.width - 40, 20);
        button.lineStyle(2, 0xffffff, 1);
        button.moveTo(0, 0);
        button.lineTo(20, 0);
        button.lineTo(20, 20);
        button.lineTo(0, 20);
        button.lineTo(0, 0);
        
        return button;
    },
    
    toggleMusic: function(sprite, pointer) {
        
        this.menuInteraction = true;
        
        if(this.bgMusic.isPlaying)
            this.bgMusic.stop();
        else
            this.bgMusic.play();
    },
    
    freeControls: function() {

        // Called constantly after some time is elapsed,
        // Enable player input some time after a button is pressed.
        if(this.menuInteraction)
            this.menuInteraction = false;
    },
    
    createMenu: function() {

        // Render the about menu on the screen:
        var w = 300;
        var h = 200;
        
        var bg = this.game.add.graphics(this.game.world.width / 2 - w / 2, this.game.world.height / 2 - h / 2);
        
        bg.beginFill(0x394130);
        bg.drawRect(0, 0, w, h);
        bg.endFill();
        
        var header = this.game.add.bitmapText(w / 2, 0, 'carrierCommand', 'ABOUT', 24);
        header.anchor.setTo(0.5);
        
        var text1 = this.game.add.bitmapText(w / 2, 50, 'carrierCommand', 'SONG: Dark City', 14);
        text1.anchor.setTo(0.5);
        var text2 = this.game.add.bitmapText(w / 2 - 10, 70, 'carrierCommand', 'Muncheybobo', 10);
        text2.anchor.setTo(0.5);
        
        
        var muncheURL = this.game.add.button(w / 2 + 60, 65, 'about', function() {  
            window.open("https://opengameart.org/users/muncheybobo", "_blank");
        }, this);
        muncheURL.scale.setTo(0.5);
        
        
        var text5 = this.game.add.bitmapText(w / 2, 130, 'carrierCommand', 'GAME: Pedro HOV', 14);
        text5.anchor.setTo(0.5);
        
        var text3 = this.game.add.bitmapText(w / 2, 150, 'carrierCommand', 'pedrohoveloso', 10);
        text3.anchor.setTo(0.5);
        
        var text4 = this.game.add.bitmapText(w / 2, 165, 'carrierCommand', '@gmail.com', 10);
        text4.anchor.setTo(0.5);
        
        bg.addChild(text1);
        bg.addChild(text2);
        bg.addChild(text3);
        bg.addChild(text4);
        bg.addChild(text5);
        bg.addChild(header);
        bg.addChild(muncheURL);
        
        return bg;
    },
    
    toggleMenu: function() {
        if(this.menu.visible)
            this.menu.visible = false;
        else
            this.menu.visible = true;
        
        this.menuInteraction = true;
    },
    
    showScores: function() {
        
        if(this.menu.visible)
            this.toggleMenu();
        
        var w = 300;
        var h = 200;
        
        var bg2 = this.game.add.graphics(this.game.world.width / 2 - w / 2, this.game.world.height / 2 - h / 2);
        
        bg2.beginFill(0x394130);
        bg2.drawRect(0, 0, w, h);
        bg2.endFill();
        
        var cScore = this.game.add.bitmapText(w / 2, 70, 'carrierCommand', 'Score: ' + this.score, 18);
        var mScore = this.game.add.bitmapText(w / 2, 110, 'carrierCommand', 'Best : ' + this.maxScore, 18);
        cScore.anchor.setTo(0.5, 0);
        mScore.anchor.setTo(0.5, 0);
        
        bg2.addChild(cScore);
        bg2.addChild(mScore);
        
        return bg2;
    }
    
};

HeroStick.game = new Phaser.Game(400, 640, Phaser.AUTO);

HeroStick.game.state.add('Game', HeroStick.GameState);
HeroStick.game.state.start('Game');