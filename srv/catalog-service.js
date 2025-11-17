const cds = require('@sap/cds');

module.exports = cds.service.impl(async function() {
  const { Products, Categories, Suppliers, Orders, OrderItems } = this.entities;

  // OPTIMIZATION #1: Fixed N+1 Query Problem with SQL JOINs
  // Using CDS's expand feature to fetch related data in a single query
  this.on('READ', Products, async (req, next) => {
    // Let CDS handle the initial query
    const products = await next();
    
    if (!Array.isArray(products) || products.length === 0) {
      return products;
    }
    
    // OPTIMIZED: Batch fetch all categories and suppliers in 2 queries instead of N+N
    const categoryIDs = [...new Set(products.map(p => p.categoryID).filter(id => id))];
    const supplierIDs = [...new Set(products.map(p => p.supplierID).filter(id => id))];
    
    // Fetch all needed categories in a single query
    const categories = categoryIDs.length > 0 
      ? await SELECT.from(Categories).where({ ID: { in: categoryIDs } })
      : [];
    
    // Fetch all needed suppliers in a single query
    const suppliers = supplierIDs.length > 0
      ? await SELECT.from(Suppliers).where({ ID: { in: supplierIDs } })
      : [];
    
    // Create lookup maps for O(1) access
    const categoryMap = new Map(categories.map(c => [c.ID, c]));
    const supplierMap = new Map(suppliers.map(s => [s.ID, s]));
    
    // Enrich products with category and supplier names
    for (let product of products) {
      const category = categoryMap.get(product.categoryID);
      if (category) {
        product.categoryName = category.name;
      }
      
      const supplier = supplierMap.get(product.supplierID);
      if (supplier) {
        product.supplierName = supplier.name;
      }
    }
    
    return products;
  });

  // OPTIMIZATION #2: Using database aggregation instead of loading all data
  this.on('generateReport', async () => {
    // OPTIMIZED: Use SQL aggregation to calculate revenue at database level
    const revenueQuery = await SELECT.from(OrderItems)
      .columns('SUM(quantity * price) as totalRevenue', 'COUNT(DISTINCT orderID) as orderCount');
    
    const { totalRevenue, orderCount } = revenueQuery[0] || { totalRevenue: 0, orderCount: 0 };
    
    // OPTIMIZED: Use JOIN to get order summaries efficiently with pagination
    const orderSummaries = await SELECT.from(Orders)
      .columns([
        'Orders.ID as orderID',
        'Orders.status',
        'SUM(OrderItems.quantity * OrderItems.price) as total'
      ])
      .leftJoin(OrderItems).on('Orders.ID = OrderItems.orderID')
      .groupBy('Orders.ID', 'Orders.status')
      .limit(100); // Add pagination to prevent memory issues
    
    return JSON.stringify({
      totalRevenue: parseFloat(totalRevenue) || 0,
      orderCount: parseInt(orderCount) || 0,
      orders: orderSummaries
    });
  });

  // OPTIMIZATION #3: Using template literals and single query with JOIN
  this.on('getProductDetails', async (req) => {
    const { productID } = req.data;
    
    // OPTIMIZED: Single query with JOINs to get all related data at once
    const result = await SELECT.one.from(Products)
      .columns([
        'Products.ID',
        'Products.name',
        'Products.price',
        'Products.stock',
        'Categories.name as categoryName',
        'Suppliers.name as supplierName',
        'Suppliers.email as supplierEmail'
      ])
      .leftJoin(Categories).on('Products.categoryID = Categories.ID')
      .leftJoin(Suppliers).on('Products.supplierID = Suppliers.ID')
      .where({ 'Products.ID': productID });
    
    if (!result) {
      return 'Product not found';
    }
    
    // OPTIMIZED: Using template literal (more efficient than concatenation)
    const details = `Product: ${result.name}
Price: $${result.price}
Stock: ${result.stock}
Category: ${result.categoryName || 'N/A'}
Supplier: ${result.supplierName || 'N/A'}
Supplier Email: ${result.supplierEmail || 'N/A'}`;
    
    return details;
  });

  // OPTIMIZATION #4: Using batch operations and transactions
  this.on('processOrder', async (req) => {
    const { orderID } = req.data;
    
    // Use a transaction to ensure data consistency
    return cds.tx(req, async (tx) => {
      const order = await tx.run(SELECT.one.from(Orders).where({ ID: orderID }));
      if (!order) {
        return 'Order not found';
      }
      
      // OPTIMIZED: Get order items with product info in a single JOIN query
      const orderItems = await tx.run(
        SELECT.from(OrderItems)
          .columns([
            'OrderItems.productID',
            'OrderItems.quantity',
            'Products.stock'
          ])
          .leftJoin(Products).on('OrderItems.productID = Products.ID')
          .where({ 'OrderItems.orderID': orderID })
      );
      
      // OPTIMIZED: Prepare batch update using CQL
      // Update all product stocks in a single operation per product
      for (let item of orderItems) {
        const newStock = item.stock - item.quantity;
        await tx.run(
          UPDATE(Products)
            .set({ stock: newStock })
            .where({ ID: item.productID })
        );
      }
      
      // Update order status
      await tx.run(UPDATE(Orders).set({ status: 'Processed' }).where({ ID: orderID }));
      
      return 'Order processed successfully';
    });
  });

  // OPTIMIZATION #5: Filtering and sorting at database level
  this.on('getOrderSummary', async (req) => {
    const { customerID } = req.data;
    
    // OPTIMIZED: Use WHERE clause to filter at database level
    // OPTIMIZED: Use ORDER BY to sort at database level
    const customerOrders = await SELECT.from(Orders)
      .where({ customerID: customerID })
      .orderBy({ orderDate: 'desc' })
      .limit(5); // Only get the 5 most recent orders
    
    // OPTIMIZED: Use aggregation query with JOIN to calculate total spent
    const totalQuery = await SELECT.from(Orders)
      .columns('SUM(OrderItems.quantity * OrderItems.price) as totalSpent')
      .leftJoin(OrderItems).on('Orders.ID = OrderItems.orderID')
      .where({ 'Orders.customerID': customerID });
    
    const totalSpent = parseFloat(totalQuery[0]?.totalSpent) || 0;
    
    return JSON.stringify({
      customerID,
      orderCount: customerOrders.length,
      totalSpent,
      recentOrders: customerOrders
    });
  });
});
