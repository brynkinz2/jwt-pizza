# Learning notes

## JWT Pizza code study and debugging

As part of `Deliverable ⓵ Development deployment: JWT Pizza`, start up the application and debug through the code until you understand how it works. During the learning process fill out the following required pieces of information in order to demonstrate that you have successfully completed the deliverable.

| User activity                                       | Frontend component | Backend endpoints | Database SQL |
| --------------------------------------------------- | ------------------ | ----------------- | ------------ |
| View home page                                      |home.tsx            |None               |None          |
| Register new user<br/>(t@jwt.com, pw: test)         |register.tsx        |POST /api/auth     |SELECT * FROM user WHERE email=? SELECT * FROM userRole WHERE userId=?. INSERT INTO auth|
| Login new user<br/>(t@jwt.com, pw: test)            |login.tsx           |PUT /api/auth      |SELECT * FROM user WHERE email=? SELECT * FROM userRole WHERE userId=?. INSERT INTO auth (JWT signature, userId)              |
| Order pizza                                         |menu.tsx, payment.tsx, delivery.tsx  |GET /api/order/menu, GET /api/franchise?page=0&limit=20&name=*, POST /api/order |SELECT * FROM menu SELECT franchise + store. INSERT INTO dinerOrder (dinerId, franchiseId, storeId, now())              |
| Verify pizza                                        |delivery.tsx        |POST {VITE_PIZZA_FACTORY_URL}/api/order/verify { jwt }   |None              |
| View profile page                                   |dinerDashboard.tsx  |GET /api/order     |SELECT id, franchiseId, storeId, date FROM dinerOrder WHERE dinerId=?  |
| View franchise<br/>(as diner)                       |franchiseDashboard.tsx  |GET /api/franchise/:userId    |SELECT objectId FROM userRole WHERE role='franchisee' AND userId=?   |
| Logout                                              |logout.tsx          |DELETE /api/auth   |DELETE FROM auth WHERE token= |
| View About page                                     |about.tsx           |None               |None          |
| View History page                                   |history.tsx         |None               |None          |
| Login as franchisee<br/>(f@jwt.com, pw: franchisee) |login.tsx           |PUT /api/auth      |SELECT user WHERE email=f@jwt.com, SELECT userRole (franchisee + objectId), INSERT INTO auth |
| View franchise<br/>(as franchisee)                  |menu.tsx            |GET /api/order/menu. GET /api/franchise?page=0&limit=20&name=*. POST /api/order |SELECT * FROM menu. SELECT franchise + store. INSERT INTO dinerOrder (dinerId, franchiseId, storeId, now()). INSERT INTO orderItem per pizza  |
| Create a store                                      |createStore.tsx     |POST /api/franchise/:franchiseId/store  |SELECT franchise admins via userRole+user INSERT INTO store  |
| Close a store                                       |closeStore.tsx      |DELETE /api/franchise/:franchiseId/store/:storeId  |SELECT franchise admins DELETE FROM store WHERE franchiseId=? AND id=?   |
| Login as admin<br/>(a@jwt.com, pw: admin)           |                    |                   |              |
| View Admin page                                     |                    |                   |              |
| Create a franchise for t@jwt.com                    |                    |                   |              |
| Close the franchise for t@jwt.com                   |                    |                   |              |
