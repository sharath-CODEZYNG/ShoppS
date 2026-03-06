import mysql.connector
import json


def load_docs():

    conn = mysql.connector.connect(
        host="yamabiko.proxy.rlwy.net",
        port=47187,
        user="root",
        password="sxdqGkBtLlELfMjdZtDoeMlYMtvMSKeM",
        database="railway"
    )

    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT * FROM products")
    rows = cursor.fetchall()

    docs = []

    for r in rows:

        attrs = json.loads(r["attributes_json"] or "{}")

        category = r["category"]
        availability = r["availability"]
        name = r["name"]
        brand = r["brand"]
        price = r["price"]
        sales = r["purchases"]

        description = r["description"] or ""
        features = r["features"] or ""
        tags = r["tags"] or ""

        extra = ""

        if category == "Food":
            veg = "vegetarian" if attrs.get("veg") else "non-vegetarian"
            calories = attrs.get("calories", "")
            expiry = attrs.get("expiry", "")

            extra = f"""
            It is a {veg} food item containing approximately {calories} calories.
            The product has an expiry period of {expiry}.
            Suitable for snacks, diet and healthy meals.
            """

        elif category == "Groceries":
            weight = attrs.get("weight", "")
            organic = "organic" if attrs.get("organic") else "regular"
            usage = attrs.get("usage", "")

            extra = f"""
            This grocery product weighs {weight} and is {organic}.
            It is commonly used for {usage}.
            Suitable for daily household cooking and needs.
            """

        elif category == "Electronic Gadgets":
            battery = attrs.get("battery", "")
            storage = attrs.get("storage", "")
            warranty = attrs.get("warranty", "")

            extra = f"""
            This electronic gadget offers {battery} battery life and {storage} storage capacity.
            It comes with {warranty} warranty.
            Suitable for everyday technology and performance usage.
            """

        text = f"""
        {name} is a product in the {category} category by the brand {brand}.
        It is priced at {price} rupees. Total {availability} quantities are available.
        This product has been purchased {sales} times.

        Description: {description}.
        Key features include {features}.
        Tags related to this product are {tags}.

        {extra}
        """

        docs.append({
            "text": text.strip(),
            "metadata": {
                "product_id": r["id"],
                "availability": availability
            }
        })

    cursor.close()
    conn.close()

    print(f"Loaded {len(docs)} products")

    return docs