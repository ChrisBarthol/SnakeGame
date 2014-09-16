$( function() {

  // Constants for the welcome message
  var WELCOME_MESSAGE = ["Snake Game: Click to Play!", "arrows change direction", "p/space: pause, f: fullscreen"],
      WELCOME_COLOR = "green";
  
  // Need the dom element, not the jQuery object
  var canvas = $("#canvas")[0],
      ctx = canvas.getContext("2d");
  
  // Some calculations to support pixel densities other than 1
  var ratio = getPixelDensityRatio();

  if( ratio > 1 )
  {
    canvas.width = canvas.width * ratio;
    canvas.height = canvas.height * ratio;
    ctx = canvas.getContext("2d");
  }
        
  var w = canvas.width,
      h = canvas.height;

  var cw = 10 * ratio,
      ch = 10 * ratio,
  
      // Defined snake movement directions
      DIRECTIONS = {
        RIGHT: {x:1,  y:0},
        LEFT:  {x:-1, y:0},
        DOWN:  {x:0,  y:1},
        UP:    {x:0,  y:-1}
      },

      // Set up a new game
      game = new Game();

  // Handle the restart of the game on a canvas click
  $("#canvas").click( function() {
    game.endGame();
    game.newGame();
  } );
  
  // Display the welcome message...FINALLY done with setup  
  overlayMessage( WELCOME_MESSAGE, WELCOME_COLOR );

  /**
   * Snake object
   * Responsible for eating, growing, collision detection, scaring kids, etc
   */
  function Snake() {

    var BEGINNING_LENGTH = 4,
        SEGMENT_COLOR = "green",
        BORDER_COLOR = "white",
        // Segments are the main stack of the snake's body
        segments = [],
        // Separate stack here for when snake eats again before 'digesting'
        eatenFood = [],
        // Direction in which the snake is moving
        currentDirection = DIRECTIONS.RIGHT;

    // Create the initial snake on instantiation of the object
    for (var i = BEGINNING_LENGTH; i > 0; i--) {
      segments.push({x: i, y: 1});
    }

    /**
     * Accessor function required by Food object for food placement
     *
     * @return Array Array of existing snake segments
     */
    this.getSegments = function() {
      return segments;
    };

    /**
     * Moves the snake (take current tail, move to the head)
     */
    this.move = function () {
      var newHead = segments.pop();
      newHead.x = segments[0].x + currentDirection.x;
      newHead.y = segments[0].y + currentDirection.y;
      segments.unshift(newHead);
    };

    /**
     * Changes the snake's direction of travel
     *
     * @param Object newDirection From DIRECTIONS constant
     */
    this.setCurrentDirection = function( newDirection )
    {
      if ( this.isNewDirectionReverse( newDirection ) )
        return;
      currentDirection = newDirection;
    };

    /**
     * Confirms the snake is not making an immediate 180 degree turn
     *
     * @param Object newDirection From DIRECTIONS constant
     * @return bool Is the turn > 90 degrees
     */
    this.isNewDirectionReverse = function( newDirection ) {
      return ((currentDirection.x + newDirection.x) === 0 &&
          (currentDirection.y + newDirection.y) === 0);
    };

    /**
     * Grows the snake by one segment
     */
    this.grow = function() {
      segments.push(eatenFood.pop());
    };

    /**
     * Adds from the eaten food stack to the actual snake
     * order really doesn't matter here, but I kept it
     *
     * @param Object food Instance of Food
     */
    this.feed = function( food ) {
      eatenFood.unshift(_.extend({}, food.getSegment() ));
    };

    /**
     * Determines if the snake has hit one of the outside walls
     *
     * @return bool True if a wall has been hit
     */
    this.hasHitWall = function() {
      var head = segments[0];
      return (head.y < 0 || head.y >= (h / ch) || 
          head.x < 0 || head.x >= (w / cw)); 
    };

    /**
     * Determines if the snake has reached a piece of food
     *
     * @param Object food Instance of Food
     * @return bool True if a piece of food has been reached
     */
    this.hasHitFood = function( food ) {
      var head = segments[0];
      return (head.x == food.getSegment().x && head.y == food.getSegment().y);
    };

    /**
     * Determines if the snake is finished swallowing
     *
     * @return bool True if finished
     */
    this.isFoodSwallowed = function() {
      var tail = segments[segments.length -1],
          bottomFood = eatenFood[eatenFood.length-1];
      return (bottomFood && 
          bottomFood.x == tail.x && bottomFood.y == tail.y);
    };

    /**
     * Determines if the snake has collided with itself
     *
     * @return bool
     */
    this.hasHitSelf = function() {
      return (_.find(segments.slice(1), segments[0]));
    };

    /**
     * Draws the tiles from the segments stack
     */
    this.draw = function() {
      var snakeLength = segments.length;
      for (var i=0; i < snakeLength; i++) {
        var snakePart = segments[i];
        drawTile(snakePart, SEGMENT_COLOR, BORDER_COLOR );
      }
    };
  }

  /**
   * Food object, the magical source of all snake growth
   * Responsible for distributing food randomly and far enough
   * from the walls
   */
  function Food() {

    var SEGMENT_COLOR = "blue",
        BORDER_COLOR = "white",
        // Buffer from walls
        FOOD_BUFFER = 2,
        // Coordinates of given food
        segment = {};

    /**
     * Accessor function used by the snake to keep track of individual
     * pieces of food
     *
     * @return Object Food segment
     */
    this.getSegment = function() {
      return segment;
    };

    /**
     * Creates a piece of food and randomly distributes it ensuring
     * certain distance from walls and no contact with snake
     *
     * @param Object snake Instance of Snake
     */
    this.make = function( snake )
    {
      if (_.isEmpty( segment )) {
        segment = {
          // new food position
          x: _.random( FOOD_BUFFER, Math.ceil( w/cw ) - FOOD_BUFFER ),
          y: _.random( FOOD_BUFFER, Math.ceil( h/ch ) - FOOD_BUFFER )
        };  
      } 
      if (_.find(snake.getSegments(), segment)) {
        // cannot put on snake, make new food
        segment = {};
        this.make( snake );
      }
      else {
        this.draw();
      }
    };

    /**
     * Draws the piece of food in the proper location on the canvas
     */
    this.draw = function() {
      drawTile( segment, SEGMENT_COLOR, BORDER_COLOR );
    };
  }

  /**
   * The master of ceremonies for the snake game
   * Handles the animation loop, keyboard events,
   * pausing, resuming, starting, ending, scorekeeping
   * This is the boss you don't want to upset
   */
  function Game () {
    var MESSAGE_COLOR = "black",
        snake = new Snake(),
        food = new Food(),
        // Should the snake grow the next iteration?
        grow = false,
        score = 0,
        // Delay between snake movement events
        loopTime = 70,
        isPaused = false,
        isEnded = false,
        animationFrameId,
        // Timestamp of last drawing
        lastPaint = 0,
        that = this;

    // Handle keyboard events (direction changes, pause, fullscreen)
    document.onkeydown = function (e) {
      var key = e.keyCode;

      switch( key ) {
        case 37:
          snake.setCurrentDirection( DIRECTIONS.LEFT );
          break;
        case 38:
          snake.setCurrentDirection( DIRECTIONS.UP );
          break;
        case 39:
          snake.setCurrentDirection( DIRECTIONS.RIGHT );
          break;
        case 40:
          snake.setCurrentDirection( DIRECTIONS.DOWN );
          break;
        case 80:
        case 32:
          that.togglePause();
          break;
        case 70:
          fullscreenElement( canvas );
          break;
        default:
          break;
      }
    };

    /**
     * Handles the main logic and drawing on the canvas
     */
    this.paint = function() {
      animationFrameId = window.requestAnimationFrame( that.paint );
      now = _.now();
      dt = now - lastPaint;
      if( dt > loopTime )
      {
        clearCanvas();
        snake.draw();
        food.make( snake );
        snake.move();

        if ( snake.hasHitWall() || snake.hasHitSelf() ) {
          that.endGame();
        }

        if ( grow )
        {
          grow = false;
          snake.grow();
        }

        grow = snake.isFoodSwallowed();

        if ( snake.hasHitFood( food ) ) {
          snake.feed( food );
          food = new Food();
          score++;
          // Make the snake faster (to a point)
          if ( loopTime > 10 )
            loopTime--;
        }
        lastPaint = now;
      }
    };

    /**
     * Toggles the 'paused' state of a running game
     * Displays an appropriate message
     */
    this.togglePause = function() {
      if( !isEnded )
      {
        isPaused = !isPaused;

        if ( isPaused )
        {
          overlayMessage( "Game Paused" );
          window.cancelAnimationFrame( animationFrameId );
        }
        else
        {
          clearCanvas();
          this.startGame();
        }
      }
    };

    /**
     * Starts the animation loop
     */
    this.startGame = function() {
      animationFrameId = window.requestAnimationFrame( this.paint );
    };

    /**
     * Resets all relevant parameters and starts a new game
     */
    this.newGame = function() {
      score = 0;
      loopTime = 70;
      lastPaint = 0;
      snake = new Snake();
      food = new Food( snake );
      isPaused = false;

      isEnded = false;
      this.startGame();
    };

    /**
     * Handles the 'game over' state
     * Displays the final score
     */
    this.endGame = function() {
      if( !isEnded )
      {
        isEnded = true;
        window.cancelAnimationFrame( animationFrameId );
        overlayMessage( "Final score: " + score );
      }
    };
  }

/* LESS INTERESTING UTILITY FUNCTIONS START HERE */

  /**
   * Overlays a semi-transparent message on the canvas
   *
   * @param Mixed (string/array) text Text or lines of text to display
   * @param String color Text color to display
   */
  function overlayMessage(text, color) {
    ctx.fillStyle = "rgba(255,255,255,0.7)"; 
    ctx.fillRect(0,0,w,h);

    ctx.fillStyle = color || "black";
    ctx.font = "bold " + 18 * ratio + "px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (text.length && text.forEach) {
      text.forEach(function(t, i) {
        fillText(t, w/2, h/2 + (i * 25 * ratio));
      });
    } else {
      fillText(text, w/2, h/2);
    }
  }

  /**
   * Helper function to call to the active canvas context
   */
  function fillText(text, x, y) {
    ctx.fillText(text, x, y);
  }

  /**
   * Helper function to blank the canvas
   */
  function clearCanvas() {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, w, h);
  }

  /**
   * Draws a tile (snake or food) on the canvas
   *
   * @param Object tile Segment object
   * @param String color Color of the tile
   * @param String strokeColor Color of the tile's border
   */
  function drawTile(tile, color, strokeColor) {
    ctx.fillStyle = color;
    ctx.fillRect(tile.x * cw, tile.y * ch, cw, ch);
    if (strokeColor) {
      ctx.strokeStyle = strokeColor;
      ctx.strokeRect(tile.x * cw, tile.y * ch, cw, ch);
    }
  }

  /**
   * Cross-browser helper function to fullscreen an element
   */
  function fullscreenElement( elem )
  {
    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if (elem.msRequestFullscreen) {
      elem.msRequestFullscreen();
    } else if (elem.mozRequestFullScreen) {
      elem.mozRequestFullScreen();
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
    }
  }

  /**
   * Cross-browser helper function to get pixel density ratio
   *
   * @return Float Density ratio
   */
  function getPixelDensityRatio()
  {
    var devicePixelRatio = window.devicePixelRatio || 1,
        backingStoreRatio = ctx.webkitBackingStorePixelRatio ||
          ctx.mozBackingStorePixelRatio ||
          ctx.msBackingStorePixelRatio ||
          ctx.oBackingStorePixelRatio ||
          ctx.backingStorePixelRatio || 1,

        ratio = devicePixelRatio / backingStoreRatio;
    return ratio;
  }
}); 
