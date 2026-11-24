import { sleep, check, group, fail } from "k6";
import http from "k6/http";
import jsonpath from "https://jslib.k6.io/jsonpath/1.0.2/index.js";

export const options = {
  cloud: {
    distribution: {
      "amazon:us:ashburn": { loadZone: "amazon:us:ashburn", percent: 100 },
    },
    apm: [],
  },
  thresholds: {},
  scenarios: {
    Imported_HAR: {
      executor: "ramping-vus",
      gracefulStop: "30s",
      stages: [
        { target: 5, duration: "30s" },
        { target: 15, duration: "1m" },
        { target: 10, duration: "30s" },
        { target: 0, duration: "30s" },
      ],
      gracefulRampDown: "30s",
      exec: "imported_HAR",
    },
  },
};

export function imported_HAR() {
  let response;

  const vars = {};

  group("Login and order - https://pizza.brynleespizza.click/", function () {
    // Homepage
    response = http.get("https://pizza.brynleespizza.click/", {
      headers: {
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/jxl,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "accept-encoding": "gzip, deflate, br, zstd",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        priority: "u=0, i",
        "sec-ch-ua":
          '"Not:A-Brand";v="8", "Chromium";v="156", "Google Chrome";v="156"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "same-origin",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": "1",
      },
    });
    sleep(20.1);

    // Login
    response = http.put(
      "https://pizza-service.brynleespizza.click/api/auth",
      '{"email":"sweettewbme@gmail.com","password":"password"}',
      {
        headers: {
          accept: "*/*",
          "accept-encoding": "gzip, deflate, br, zstd",
          "accept-language": "en-US,en;q=0.9",
          "content-type": "application/json",
          origin: "https://pizza.brynleespizza.click",
          priority: "u=1, i",
          "sec-ch-ua":
            '"Not:A-Brand";v="8", "Chromium";v="156", "Google Chrome";v="156"',
          "sec-ch-ua-mobile": "?1",
          "sec-ch-ua-platform": '"Android"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-site",
        },
      },
    );
    if (
      !check(response, {
        "status equals 200": (response) => response.status.toString() === "200",
      })
    ) {
      console.log(response.body);
      fail("Login was *not* 200");
    }

    vars["token2"] = jsonpath.query(response.json(), "$.token")[0];

    sleep(3.7);

    // Get menu
    response = http.get(
      "https://pizza-service.brynleespizza.click/api/order/menu",
      {
        headers: {
          accept: "*/*",
          "accept-encoding": "gzip, deflate, br, zstd",
          "accept-language": "en-US,en;q=0.9",
          authorization: `Bearer ${vars["token2"]}`,
          "content-type": "application/json",
          "if-none-match": 'W/"1fc-cgG/aqJmHhElGCplQPSmgl2Gwk0"',
          origin: "https://pizza.brynleespizza.click",
          priority: "u=1, i",
          "sec-ch-ua":
            '"Not:A-Brand";v="8", "Chromium";v="156", "Google Chrome";v="156"',
          "sec-ch-ua-mobile": "?1",
          "sec-ch-ua-platform": '"Android"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-site",
        },
      },
    );

    // Get franchise
    response = http.get(
      "https://pizza-service.brynleespizza.click/api/franchise?page=0&limit=20&name=*",
      {
        headers: {
          accept: "*/*",
          "accept-encoding": "gzip, deflate, br, zstd",
          "accept-language": "en-US,en;q=0.9",
          authorization: `Bearer ${vars["token2"]}`,
          "content-type": "application/json",
          "if-none-match": 'W/"5c-UrU6FPurLC0JcnOrzddwdfUXFBA"',
          origin: "https://pizza.brynleespizza.click",
          priority: "u=1, i",
          "sec-ch-ua":
            '"Not:A-Brand";v="8", "Chromium";v="156", "Google Chrome";v="156"',
          "sec-ch-ua-mobile": "?1",
          "sec-ch-ua-platform": '"Android"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-site",
        },
      },
    );
    sleep(0.9);

    // Purchase Pizza
    response = http.post(
      "https://pizza-service.brynleespizza.click/api/order",
      '{"items":[{"menuId":1,"description":"Veggie","price":0.0038}],"storeId":"1","franchiseId":1}',
      {
        headers: {
          accept: "*/*",
          "accept-encoding": "gzip, deflate, br, zstd",
          "accept-language": "en-US,en;q=0.9",
          authorization: `Bearer ${vars["token2"]}`,
          "content-type": "application/json",
          origin: "https://pizza.brynleespizza.click",
          priority: "u=1, i",
          "sec-ch-ua":
            '"Not:A-Brand";v="8", "Chromium";v="156", "Google Chrome";v="156"',
          "sec-ch-ua-mobile": "?1",
          "sec-ch-ua-platform": '"Android"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-site",
        },
      },
    );
    if (
      !check(response, {
        "purchase status equals 200": (r) => r.status === 200,
      })
    ) {
      console.log(response.body);
      fail("Purchase was *not* 200");
    }

    vars["pizzaJwt"] = jsonpath.query(response.json(), "$.jwt")[0];
    sleep(1.5);

    // Verify Pizza
    response = http.post(
      "https://pizza-factory.cs329.click/api/order/verify",
      `{"jwt":"${vars["pizzaJwt"]}"}`,
      {
        headers: {
          accept: "*/*",
          "accept-encoding": "gzip, deflate, br, zstd",
          "accept-language": "en-US,en;q=0.9",
          authorization: `Bearer ${vars["token2"]}`,
          "content-type": "application/json",
          origin: "https://pizza.brynleespizza.click",
          priority: "u=1, i",
          "sec-ch-ua":
            '"Not:A-Brand";v="8", "Chromium";v="156", "Google Chrome";v="156"',
          "sec-ch-ua-mobile": "?1",
          "sec-ch-ua-platform": '"Android"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "cross-site",
          "sec-fetch-storage-access": "active",
        },
      },
    );
    check(response, { "verify status equals 200": (r) => r.status === 200 });
  });
}
