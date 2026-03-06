CREATE DATABASE IF NOT EXISTS ecommerce_db;
USE ecommerce_db;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('customer', 'admin') DEFAULT 'customer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255),
    category VARCHAR(100),
    brand VARCHAR(100),
    price DECIMAL(10,2),
    availability INT DEFAULT 100,
    views INT DEFAULT 0,
    purchases INT DEFAULT 0,
    rating_avg DECIMAL(3,2) DEFAULT 0,
    rating_count INT DEFAULT 0,
    description TEXT,
    features TEXT,
    tags TEXT,
    attributes_json TEXT,
    image_url TEXT
);

INSERT INTO categories (name, description) VALUES
('Food', 'Fresh food items and snacks'),
('Groceries', 'Daily grocery items and essentials'),
('Electronic Gadgets', 'Modern electronic devices and accessories');

CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    status ENUM('pending', 'paid', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
    total_amount DECIMAL(10,2) NOT NULL,
    shipping_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);


INSERT INTO products (id, name, category, brand, price, description, features, tags, attributes_json) VALUES
(1,'Protein Energy Bar Chocolate','Food','NutriFit',45,'Chocolate flavored protein snack bar for quick energy.','12g protein, low sugar, ready to eat','snack protein gym healthy chocolate','{"calories":210,"veg":true,"expiry":"6 months"}'),

(2,'Whole Wheat Bread','Food','FarmFresh',40,'Soft whole wheat bread for breakfast and sandwiches.','High fiber, preservative free','bread breakfast healthy wheat','{"calories":120,"veg":true,"expiry":"4 days"}'),

(3,'Greek Yogurt Natural','Food','MilkyDay',85,'Thick probiotic yogurt good for digestion.','High protein, low fat','yogurt probiotic breakfast diet','{"calories":95,"veg":true,"protein_high":true,"expiry":"10 days"}'),

(4,'Spicy Chicken Momos','Food','TastyBites',120,'Frozen chicken momos with spicy filling.','Ready to steam, juicy taste','nonveg snack frozen spicy','{"calories":300,"veg":false,"expiry":"3 months"}'),

(5,'Veg Sandwich Pack','Food','QuickEats',60,'Fresh vegetable sandwich pack for lunch.','Tomato, cucumber, mayo filling','veg sandwich snack lunch','{"calories":180,"veg":true,"expiry":"2 days"}'),

(6,'Peanut Butter Crunchy','Food','NutriSpread',180,'Crunchy peanut butter rich in protein.','No added sugar, roasted peanuts','spread protein breakfast gym','{"calories":588,"veg":true,"expiry":"8 months"}'),

(7,'Oats Breakfast Mix','Food','HealthStart',150,'Instant oats for healthy breakfast meals.','High fiber, quick cooking','oats healthy diet fiber','{"calories":150,"veg":true,"expiry":"9 months"}'),

(8,'Cheese Slices','Food','DailyDairy',110,'Creamy cheese slices for sandwiches and burgers.','Calcium rich, fresh dairy','cheese dairy sandwich burger','{"calories":90,"veg":true,"expiry":"20 days"}'),

(9,'Brown Eggs Pack 12','Food','FarmNest',95,'Farm fresh protein rich eggs.','Grade A eggs, hygienic packing','eggs protein breakfast nonveg','{"calories":70,"veg":false,"expiry":"15 days"}'),

(10,'Paneer Fresh 200g','Food','MilkyDay',90,'Soft cottage cheese ideal for cooking.','Fresh milk, high protein','paneer vegetarian protein cooking','{"calories":265,"veg":true,"expiry":"7 days"}'),

(11,'Veg Noodles Cup','Food','SnackTime',35,'Instant vegetable noodles cup.','Ready in 3 minutes','noodles instant snack quick','{"calories":320,"veg":true,"expiry":"6 months"}'),

(12,'Chocolate Muffin','Food','BakeHouse',30,'Soft baked chocolate muffin dessert.','Freshly baked, sweet treat','cake muffin dessert chocolate','{"calories":260,"veg":true,"expiry":"3 days"}'),

(13,'Cornflakes Classic','Food','MorningCrunch',210,'Crispy cornflakes cereal for breakfast.','Iron fortified, crunchy flakes','cereal breakfast healthy kids','{"calories":110,"veg":true,"expiry":"10 months"}'),

(14,'Apple Juice 1L','Food','FruitPure',99,'Fresh apple juice with no added sugar.','Natural fruit extract','juice drink healthy fruit','{"calories":45,"veg":true,"expiry":"6 months"}'),

(15,'Banana Chips Salted','Food','Snacky',55,'Crispy salted banana chips snack.','Deep fried crunchy slices','chips snack salty tea-time','{"calories":540,"veg":true,"expiry":"5 months"}'),

(16,'Veg Salad Bowl','Food','FreshBowl',70,'Mixed vegetable salad for healthy meals.','Low calorie, fiber rich','salad healthy diet lowcalorie','{"calories":80,"veg":true,"expiry":"1 day"}'),

(17,'Chicken Sausage Pack','Food','MeatMaster',160,'Smoked chicken sausages rich in protein.','Ready to fry or grill','sausage nonveg protein snack','{"calories":250,"veg":false,"expiry":"2 months"}'),

(18,'Butter Cookies','Food','SweetTreats',120,'Crunchy butter cookies for tea time.','Fresh bakery style cookies','cookies biscuit sweet snack','{"calories":500,"veg":true,"expiry":"4 months"}'),

(19,'Milk Chocolate Bar','Food','ChocoLove',50,'Creamy milk chocolate bar.','Smooth cocoa blend','chocolate dessert sweet','{"calories":230,"veg":true,"expiry":"12 months"}'),

(20,'Protein Shake Vanilla','Food','NutriFit',95,'Ready to drink vanilla protein shake.','20g protein, low fat','protein drink gym shake fitness','{"calories":160,"veg":true,"expiry":"5 months"}'),

(21,'Basmati Rice 5kg','Groceries','NatureFarm',649,'Premium long grain aromatic rice.','Aged rice, easy cooking','rice staple organic healthy','{"weight":"5kg","organic":true}'),

(22,'Toor Dal 1kg','Groceries','DailyChoice',189,'Protein rich split pigeon peas.','Natural and clean pulses','dal protein pulses vegetarian','{"weight":"1kg"}'),

(23,'Sunflower Oil 1L','Groceries','FreshHarvest',159,'Refined cooking oil for daily use.','Low cholesterol oil','oil cooking healthy refined','{"volume":"1L"}'),

(24,'Wheat Flour Atta 5kg','Groceries','GrainGold',280,'Stone ground whole wheat flour.','Soft rotis and chapatis','atta flour wheat cooking','{"weight":"5kg"}'),

(25,'Sugar White 1kg','Groceries','SweetPure',45,'Refined white sugar crystals.','Fine granules','sugar sweet baking cooking','{"weight":"1kg"}'),

(26,'Salt Iodized 1kg','Groceries','HealthSalt',20,'Iodized table salt.','Essential minerals','salt cooking daily essential','{"weight":"1kg"}'),

(27,'Tea Powder Premium','Groceries','ChaiKing',210,'Strong flavored black tea leaves.','Rich aroma','tea beverage chai drink','{"weight":"500g"}'),

(28,'Coffee Instant 200g','Groceries','WakeUp',175,'Instant coffee granules.','Strong caffeine kick','coffee instant beverage energy','{"weight":"200g"}'),

(29,'Detergent Powder 2kg','Groceries','PureLife',299,'Deep cleaning detergent.','Machine wash safe','detergent cleaning laundry','{"weight":"2kg"}'),

(30,'Dishwash Liquid 500ml','Groceries','CleanMate',85,'Liquid dish cleaner.','Grease removal formula','dishwash cleaning kitchen','{"volume":"500ml"}'),

(31,'Bath Soap Pack 4','Groceries','FreshGlow',120,'Moisturizing bathing soap.','Aloe vera extract','soap hygiene personalcare','{"quantity":4}'),

(32,'Toilet Cleaner 1L','Groceries','CleanMate',99,'Strong disinfectant cleaner.','Kills germs fast','cleaner disinfectant hygiene','{"volume":"1L"}'),

(33,'Turmeric Powder 200g','Groceries','SpiceWorld',40,'Pure turmeric powder.','Natural spice','turmeric spice cooking indian','{"weight":"200g"}'),

(34,'Chilli Powder 200g','Groceries','SpiceWorld',50,'Red chilli powder for spicy dishes.','Fine ground spice','chilli spice hot cooking','{"weight":"200g"}'),

(35,'Jeera Cumin 100g','Groceries','SpiceWorld',35,'Whole cumin seeds for seasoning.','Fresh aroma','cumin spice seasoning','{"weight":"100g"}'),

(36,'Tomato Ketchup 1kg','Groceries','TastySauce',110,'Sweet and tangy tomato ketchup.','Kids favorite sauce','ketchup sauce snack','{"weight":"1kg"}'),

(37,'Biscuits Marie Pack','Groceries','TeaTime',25,'Light tea biscuits.','Low sugar','biscuit snack tea light','{"weight":"150g"}'),

(38,'Paper Towels Roll','Groceries','CleanHome',60,'Absorbent kitchen paper towels.','Multi purpose cleaning','tissue cleaning kitchen','{"quantity":1}'),

(39,'Garbage Bags Large','Groceries','CleanHome',95,'Durable trash bags for home use.','Leak proof plastic','garbage trash bags waste','{"quantity":20}'),

(40,'Mineral Water 2L','Groceries','PureDrop',35,'Safe drinking mineral water.','Filtered and hygienic','water drinking bottle','{"volume":"2L"}'),

(41,'AstraBook Pro 15 Laptop','Electronic Gadgets','Astra',58999,'Gaming laptop for students and developers.','16GB RAM, RTX GPU, SSD','gaming laptop coding performance','{"ram":"16GB","battery":"6 hours"}'),

(42,'Smartphone Nova X','Electronic Gadgets','NovaTech',19999,'Budget smartphone with long battery life.','6GB RAM, 6000mAh battery','mobile phone battery budget','{"battery":"6000mAh","storage":"128GB"}'),

(43,'Bluetooth Earbuds AirTune','Electronic Gadgets','Sonic',2499,'Wireless earbuds with deep bass.','Touch controls, noise isolation','earbuds music wireless','{"battery":"24 hours"}'),

(44,'Smartwatch FitTrack','Electronic Gadgets','FitTech',3499,'Fitness smartwatch with heart rate tracking.','Steps, sleep monitor, waterproof','watch fitness health tracker','{"battery":"7 days"}'),

(45,'Power Bank 10000mAh','Electronic Gadgets','VoltMax',999,'Portable charging power bank.','Fast charging dual output','powerbank battery travel','{"battery":"10000mAh"}'),

(46,'Gaming Mouse RGB','Electronic Gadgets','GamePro',1299,'High precision gaming mouse.','RGB lights adjustable DPI','mouse gaming accessory','{"dpi":"12000"}'),

(47,'Mechanical Keyboard','Electronic Gadgets','KeyMaster',3499,'Mechanical keyboard for typing and gaming.','Blue switches backlit','keyboard mechanical gaming','{"switch":"blue"}'),

(48,'LED Monitor 24inch','Electronic Gadgets','VisionX',7999,'Full HD LED computer monitor.','75Hz refresh rate','monitor display hd office','{"size":"24 inch"}'),

(49,'USB Flash Drive 64GB','Electronic Gadgets','DataSafe',599,'Portable USB storage drive.','High speed transfer','pendrive storage portable','{"capacity":"64GB"}'),

(50,'External Hard Disk 1TB','Electronic Gadgets','DataSafe',3899,'Backup and storage device.','USB 3.0 fast speed','harddisk storage backup','{"capacity":"1TB"}'),

(51,'WiFi Router Dual Band','Electronic Gadgets','NetLink',2499,'High speed home router.','Dual band 5GHz','router wifi internet','{"speed":"1200Mbps"}'),

(52,'Portable Speaker Boom','Electronic Gadgets','Sonic',1999,'Loud portable bluetooth speaker.','Deep bass waterproof','speaker music party','{"battery":"10 hours"}'),

(53,'Webcam HD Pro','Electronic Gadgets','VisionX',1599,'HD webcam for online meetings.','1080p video mic built-in','webcam office meetings','{"resolution":"1080p"}'),

(54,'Tablet Lite 10','Electronic Gadgets','NovaTech',13999,'Lightweight tablet for study and entertainment.','10 inch display 4GB RAM','tablet study media','{"battery":"8 hours"}'),

(55,'Tripod Stand Pro','Electronic Gadgets','CaptureIt',899,'Stable tripod for camera or phone.','Adjustable height','tripod camera stand vlog','{"height":"150cm"}'),

(56,'Portable SSD 512GB','Electronic Gadgets','DataSafe',5599,'High speed portable SSD.','Ultra fast data transfer','ssd storage portable fast','{"capacity":"512GB"}'),

(57,'Hair Dryer Turbo','Electronic Gadgets','StylePro',1499,'Quick drying hair dryer.','Hot and cool air modes','hairdryer grooming appliance','{"power":"1200W"}'),

(58,'Electric Kettle 1.5L','Electronic Gadgets','HomeEase',999,'Fast boiling electric kettle.','Auto cut off stainless steel','kettle kitchen boiling','{"capacity":"1.5L"}'),

(59,'Extension Board 6 Socket','Electronic Gadgets','SafePlug',499,'Multi socket power extension board.','Surge protection','extension power safety','{"sockets":6}'),

(60,'Mini Projector BeamLite','Electronic Gadgets','VisionX',6999,'Compact home theater projector.','HD projection HDMI support','projector movie portable','{"resolution":"720p"}');

-- Create product_ratings table to track individual user ratings
CREATE TABLE IF NOT EXISTS product_ratings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    order_id INT DEFAULT NULL,
    rating TINYINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Table to track product views per user/session/ip to avoid duplicate counting
CREATE TABLE IF NOT EXISTS product_views (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    user_id INT DEFAULT NULL,
    session_key VARCHAR(255) DEFAULT NULL,
    ip VARCHAR(100) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Assign unique values for views, purchases, rating_avg, rating_count for each product
UPDATE products SET views = id * 3, purchases = FLOOR(id / 2), rating_avg = 3.5 + (id % 5) * 0.2, rating_count = (id % 7) + 1;
