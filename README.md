# Website visitor activity tracker, a fullstack task

- [Task description](#task)
  - [Frontend](#frontend)
  - [Tracker logic](#tracker-logic)
  - [Backend](#backend)
  - [Technical requirements](#technical-requirements)
  - [<font color="orange">Bonus track</font>](#bonus-track)
- [Implementation](#implementation)
  - [<font color="orange">Bonus track implementation</font>](#bonus-track-implementation)

## Task description

Let's write a service for tracking website visitor activity in the browser. Something remotely resembling Google Analytics. The visitor walks around the site and clicks on buttons, and logs of his activity are sent to the server and stored in the database.

The stack is `Node.js`, `TypeScript` and `MongoDB`.

### Frontend

Let's serve the same HTML page:

```html
<html>
  <head>
    <title>My website</title>
    <script src="http://localhost:8888/tracker"></script>
    <script>
      tracker.track('pageview');
      tracker.track('test', 'one', 'two', 'three');
    </script>
  </head>
  <body>
    <button onclick="tracker.track('click-button')">Click me</button>
    <ul>
      <li>
        <a href="/1.html" onclick="tracker.track('click-link', '1')">1.html</a>
      </li>
      <li>
        <a href="/2.html" onclick="tracker.track('click-link', '2')">2.html</a>
      </li>
      <li>
        <a href="/3.html" onclick="tracker.track('click-link', '3', 'three')"
          >3.html</a
        >
      </li>
    </ul>
  </body>
</html>
```

to following addresses:

- http://localhost:50000/1.html
- http://localhost:50000/2.html
- http://localhost:50000/3.html

The JavaScript code of the tracker to be implemented should be at `http://localhost:8888/tracker`

### Tracker logic

The tracker should expose a single public method adhering to the following interface:

```ts
interface Tracker {
  track(event: string, ...tags: string[]): void;
}
```

Each time this method is called, the next `event` object is put into the buffer. The following set is added to it, in addition to the transferred data:

- `url` — full address of the page,
- `title` — the `<title>` content of the current page,
- `ts` — local user time in seconds (Unix time).

The `event` object ends up looking like this:

```js
{
	"event": "pageview",
	"tags": [],
	"url": "http://localhost:50000/1.html",
	"title": "My website",
	"ts": 1675209600
}
```

Events are sent to the backend in an array with the `POST` method to http://localhost:8888/track

We want to send data to the backend as quickly as possible, but minimize the number of requests.
To do this, we do the following:

- Events are stored in a buffer when they appear.
- The buffer is sent to the backend as soon as events appear in it, but not more often than once per second, or when at least 3 events appear in the buffer, or when the browser is closed.
- If sending events fails due to network problems, we wait for a second and return the events to the buffer. From there they are sent again according to the general rules.

### Backend

- Use any microframework (`Koa`, `Fastify`, `Express`, etc.) or pure `http`. Do not take `NestJS` and other massive frameworks.
- The application listens on ports `50000` and `8888` and responds to the requests described above.
- Upon receiving an array of events to `http://localhost:8888/track`, the application puts them into a `MongoDB` collection of `tracks`. One document per event. Multiple events are inserted into the database with a single query.
- The incoming request is validated for compliance with the format described above. If the validation passes, it responds with the code `200`, otherwise — `422`.
- The application responds to the client without waiting for the data to be inserted into the database.

### Technical requirements

- The tracker must work in the latest version of Chrome. Don't think about supporting older browsers.
- The database to store events is `MongoDB`.
- Use `TypeScript` on both the backend and frontend.
- Don't use cumbersome architectural patterns. The project is simple, it's better to spend time on code readability and debugging TOR requirements.
- Format the code with [Prettier](https://prettier.io/). Use default config.
- Do not use Docker.
- Put a `README` file in the repository describing how to build and run the application. Do not describe how to install `MongoDB`, it is assumed that the database is already installed.

### Bonus track

These are optional requirements. Do them if the test seems too easy for you.

1. _Write your own snippet for inserting the tracker into the page, replace `<script src='http://localhost:8888/tracker'></script>` with it, and explain why this is so complicated._

   Sample snippet from Google Analytics:

```html
  <!-- Google Analytics -->
  <script>
    (function (i, s, o, g, r, a, m) {
      i['GoogleAnalyticsObject'] = r;
      (i[r] =
        i[r] ||
        function () {
          (i[r].q = i[r].q || []).push(arguments);
        }),
        (i[r].l = 1 * new Date());
      (a = s.createElement(o)), (m = s.getElementsByTagName(o)[0]);
      a.async = 1;
      a.src = g;
      m.parentNode.insertBefore(a, m);
    })(
      window,
      document,
      'script',
      'https://www.google-analytics.com/analytics.js',
      'ga',
    );

    ga('create', 'UA-XXXXX-Y', 'auto');
    ga('send', 'pageview');
  </script>
  <!-- End Google Analytics -->
```

  <!-- <font color="orange"> Implemented in commit </font> -->

2. _Make it so that when a link is clicked, all events have time to be sent to the backend before going to a new page._

3. _Make it so that a `CORS` request does not preflight the `OPTIONS` request._

## Implementation:

- Install Node.js following [https://nodejs.org/en/download](https://nodejs.org/en/download)

- To install dependencies run:
  ```sh
  npm i
  ```
- To build the project run:
  ```sh
  npm run build
  ```
- To start the project run:

  ```sh
  npm start
  ```

- Open [http://localhost:50000/1.html](http://localhost:50000/1.html) in your browser.

### Bonus track implementation:

1. The snippet for insertion of the tracker into the page instead of the `<script src='http://localhost:8888/tracker'></script>` is the following:

```js
(function (w, d, n, u, t, s, e) {
  (s = d.createElement(n)),
    (e = d.getElementsByTagName(n)[0]),
    (s.async = 1),
    (s.src = u),
    e.parentNode.insertBefore(s, e),
    (w[t] = w[t] || {
      track: function (v, g) {
        (w[t].q = w[t].q || []).push(arguments);
      },
    });
})(window, document, 'script', 'http://localhost:8888/tracker', 'tracker');
```

"Why is this so complicated?" — Since there is no way to guarantee that the external script will run _before_ the built-in script (the one that logs `pageview` and `test` events) without modifying the latter, we need to temporarily define a global `tracker` object with a `q` property and a `track` method that will add events to this temporary `q` buffer when called.

Then, in the code of the external script, this temporary object is replaced with a persistent one — an instance of the EventTracker class. The events stored in the `q` buffer are then logged using the `track` method of the class.

The `async` attribute is set to a truthy value to ensure that loading the script does not block HTML parsing and that the script is executed as early as possible.

The code snippet here is wrapped in an immediately invoked function to avoid polluting the global namespace with variables such as w, d, n, u, t, s, and e. This same result can also be achieved by rewriting the snippet as follows:

```js
{
  const w = window,
    d = document,
    n = 'script',
    u = 'http://localhost:8888/tracker',
    t = 'tracker';
  let s, e;
  (s = d.createElement(n)),
    (e = d.getElementsByTagName(n)[0]),
    (s.async = 1),
    (s.src = u),
    e.parentNode.insertBefore(s, e),
    (w[t] = w[t] || {
      track: function (v, g) {
        (w[t].q = w[t].q || []).push(arguments);
      },
    });
}
```
