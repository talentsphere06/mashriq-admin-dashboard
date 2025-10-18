"use client";

import ProtectedRoute from "@/app/components/protected/page";
import { client } from "@/sanity/lib/client";
import { Order, Product, Variant } from "@/sanity/lib/types"; 
import { SignedIn, SignOutButton, useUser } from "@clerk/nextjs";
import { round } from "lodash";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo, useCallback } from "react";
import Swal from "sweetalert2";

interface NewProduct extends Omit<Product, "variants" | "slug" | "_id"> {
    _id: string; 
    slug?: { current: string; _type: 'slug' };
    category: string;
    categoryManual?: string;
    sizes: string[];
}

interface NewVariant {
    color: string;
    imageFile: File | null;
}

const createSlug = (name: string) => ({
    _type: 'slug',
    current: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-*|-*$/g, ''),
});

const generateUniqueKey = () => `key-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

const AdminDashboard = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [filter, setFilter] = useState("All");
    const [activeSection, setActiveSection] = useState<"orders" | "products">("orders");
    const [isEditing, setIsEditing] = useState(false);
    
    const [newProduct, setNewProduct] = useState<NewProduct>({
    _id: "",
    name: "",
    price: 0,
    stock: 0,
    description: "",
    category: "Mashriq Wear",
    categoryManual: "",
    sizes: [],
    });

    const [newVariants, setNewVariants] = useState<NewVariant[]>([]);
    const [currentVariant, setCurrentVariant] = useState<NewVariant>({ color: "white", imageFile: null });

    const { user, isSignedIn, isLoaded } = useUser();
    const router = useRouter();
    const [isUserLoaded, setIsUserLoaded] = useState(false);
    const [isDataFetching, setIsDataFetching] = useState(false);
    
    const availableColors = ["white", "red", "blue", "black", "yellow", "brown", "orange", "purple", "green"];
    const availableSizes = ["xs", "s", "m", "l", "xl"];
    const availableCategories = ["Mashriq Wear", "Gul Ahmed", "Maria B"]; 

    const totalEarnings = useMemo(() => orders.reduce((sum, order) => sum + round(order.total, 2), 0), [orders]);
    const totalOrders = orders.length;
    const pendingOrders = useMemo(() => orders.filter(order => order.status === "pending").length, [orders]);
    const shippedOrders = useMemo(() => orders.filter(order => order.status === "shipped").length, [orders]);
    const deliveredOrders = useMemo(() => orders.filter(order => order.status === "delivered").length, [orders]);
    
    // Order Filtering
    const filteredOrders = useMemo(() => 
        filter === "All" ? orders : orders.filter((order) => order.status === filter)
    , [orders, filter]);


    useEffect(() => {
        if (!isLoaded) return;
        if (!isSignedIn) {
            router.push("/");
        } else if (user?.primaryEmailAddress?.emailAddress !== "talentsphere06@gmail.com") {
            router.replace("/");
        } else {
            setIsUserLoaded(true);
        }
    }, [isSignedIn, user, isLoaded, router]);

    const fetchData = useCallback(async () => {
        if (!isUserLoaded || isDataFetching) return;
        setIsDataFetching(true);

        const orderQuery = `*[_type == "order"]{ 
            _id, fullName, phone, email, address, city, zipCode, total, discount, orderDate, status, 
            cartItems[]{ 
                _key, name, quantity, price, 
                image{ 
                    asset->{_id, url} 
                } 
            } 
        }`;
        
        const productQuery = `*[_type == "product"]{ 
            _id, name, price, stock, description, slug, category, sizes, 
            variants[]{
                _key, // Ensure _key is fetched for existing products
                color,
                images[]{
                    _key, // Ensure _key is fetched for existing images
                    asset->{
                        _id, _type, url
                    }
                }
            }
        }`;

        try {
            const [orderData, productData] = await Promise.all([
                client.fetch(orderQuery),
                client.fetch(productQuery),
            ]);
            setOrders(orderData);
            setProducts(productData as Product[]);
        } catch (error) {
            console.error("Error fetching data:", error);
            Swal.fire("Error", "Failed to load dashboard data.", "error");
        } finally {
            setIsDataFetching(false);
        }
    }, [isUserLoaded, isDataFetching]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const toggleOrderDetails = (orderId: string) => {
        setSelectedOrderId((prev) => (prev === orderId ? null : orderId));
    };
    
    const handleDelete = async (orderId: string) => {
        const result = await Swal.fire({
            title: "Are you sure?",
            text: "You won't be able to revert this!",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#3085d6",
            cancelButtonColor: "#d33",
            confirmButtonText: "Yes, delete it!"
        });
        if (!result.isConfirmed) return;
        try {
            await client.delete(orderId);
            setOrders((prevOrder) => prevOrder.filter((order) => order._id !== orderId));
            Swal.fire("Deleted!", "The order has been deleted.", "success");
        } catch (error) {
            Swal.fire("Error!", "Failed to delete the order.", "error");
            console.error("Delete order error:", error);
        }
    };

    const handleStatusChange = async (orderId: string, newStatus: string) => {
        try {
            await client.patch(orderId).set({ status: newStatus }).commit();
            setOrders((prevOrders) =>
                prevOrders.map((order) =>
                    order._id === orderId ? { ...order, status: newStatus } : order
                )
            );
            Swal.fire("Updated!", `Order marked as ${newStatus}.`, "success");
        } catch (error) {
            Swal.fire("Error!", "Failed to update order status.", "error");
            console.error("Update status error:", error);
        }
    };
    
    const addNewVariantToProduct = () => {
        if (!currentVariant.color) {
            Swal.fire("Validation", "Please select a color for the variant.", "warning");
            return;
        }
        if (!currentVariant.imageFile) {
            Swal.fire("Validation", "Please upload an image for the variant.", "warning");
            return;
        }
        if (newVariants.some(v => v.color === currentVariant.color)) {
            Swal.fire("Validation", `Variant with color '${currentVariant.color}' already added.`, "warning");
            return;
        }

        setNewVariants(prev => [...prev, currentVariant]);
        const nextColor = availableColors.find(c => !newVariants.some(v => v.color === c) && c !== currentVariant.color) || availableColors[0];
        setCurrentVariant({ color: nextColor, imageFile: null });
        
        Swal.fire("Variant Added", `Color **${currentVariant.color}** added successfully!`, "success");
    };


    const handleAddProduct = async () => {
        if (!newProduct.name || newProduct.price <= 0 || newProduct.stock < 0) {
            Swal.fire("Validation", "Please fill out all required fields (Name, Price, Stock).", "warning");
            return;
        }
        if (newVariants.length === 0) {
            Swal.fire("Validation", "Please add at least one color variant with an image.", "warning");
            return;
        }

        const variantsToCreate: Variant[] = [];
        Swal.fire({
            title: "Adding Product...",
            text: "Uploading images and creating document. Please wait.",
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            },
        });

        try {
            await Promise.all(newVariants.map(async (variant) => {
                let imageAssetRef = null;
                if (variant.imageFile) {
                    const uploadedAsset = await client.assets.upload('image', variant.imageFile);
                    imageAssetRef = uploadedAsset._id;
                }
                if (imageAssetRef) {
                    variantsToCreate.push({
                        _type: "variant",
                        _key: `variant-${Date.now()}-${Math.random()}`,
                        color: variant.color,
                        images: [{
                            _type: "image",
                            _key: `image-${Date.now()}-${Math.random()}`,
                            asset: { _type: "reference", _ref: imageAssetRef }
                        }]
                    });
                }
            }));

            let categoryValue = newProduct.category;
            if (categoryValue === "other" && newProduct.categoryManual) {
                categoryValue = newProduct.categoryManual;
            }

            const doc: any = {
                _type: 'product',
                name: newProduct.name,
                price: Number(newProduct.price),
                stock: Number(newProduct.stock),
                description: newProduct.description,
                slug: createSlug(newProduct.name),
                category: categoryValue,
                sizes: newProduct.sizes,
                variants: variantsToCreate.length > 0 ? variantsToCreate : undefined 
            };

            await client.create(doc);
            await fetchData(); 
            setNewProduct({ _id: "", name: "", price: 0, stock: 0, description: "", category: "Mashriq Wear", categoryManual: "", sizes: [] });
            setNewVariants([]);
            setCurrentVariant({ color: availableColors[0], imageFile: null });

            Swal.close();
            Swal.fire("Success!", "Product added successfully with variants.", "success");
        } catch (error) {
            Swal.close();
            Swal.fire("Error!", "Failed to add product. See console for details.", "error");
            console.error("Add product error:", error);
        }
    };

    const confirmDeleteProduct = async (productId: string) => {
        const result = await Swal.fire({
            title: "Are you sure?",
            text: "This product will be deleted!",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#3085d6",
            cancelButtonColor: "#d33",
            confirmButtonText: "Yes, delete it!"
        });

        if (!result.isConfirmed) return;

        Swal.fire({
            title: "Deleting...",
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading(),
        });
        try {
            await client.delete(productId);
            setProducts((prevProducts) => prevProducts.filter((p) => p._id !== productId));
            Swal.close();
            Swal.fire("Deleted!", "Product has been deleted.", "success");
        } catch (error) {
            Swal.close();
            Swal.fire("Error!", "Failed to delete product.", "error");
            console.error("Delete product error:", error);
        }
    };

    const handleEditProduct = async (product: Product) => {
        if (!product.name || product.price <= 0 || product.stock < 0) {
            Swal.fire("Validation", "Please fill out all required fields (Name, Price, Stock).", "warning");
            return;
        }

        try {
            const patch: any = {
                name: product.name,
                price: Number(product.price),
                stock: Number(product.stock),
                description: product.description,
                category: product.category,
                sizes: product.sizes,
            };

            await client
                .patch(product._id)
                .set(patch)
                .commit();

            setProducts(products.map(p => p._id === product._id ? product : p));
            setSelectedProduct(null);
            setIsEditing(false);
            Swal.fire("Success!", "Product metadata updated successfully.", "success");
        } catch (error) {
            Swal.fire("Error!", "Failed to update product.", "error");
            console.error("Edit product error:", error);
        }
    };


    const selectedOrderDetails: Order | undefined = orders.find((o) => o._id === selectedOrderId);
    const getProductImageUrl = (product: Product): string | null => {
        const asset = product.variants?.[0]?.images?.[0]?.asset;
        return asset?.url || null;
    };
    
    const selectedColors = useMemo(() => newVariants.map(v => v.color), [newVariants]);


    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
                
                <nav className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 shadow-xl flex justify-between items-center">
                    <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
                    <div className="flex space-x-4">
                        <button
                            onClick={() => setActiveSection("orders")}
                            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 cursor-pointer ${
                                activeSection === "orders"
                                    ? "bg-white text-blue-600 shadow-lg transform scale-105"
                                    : "bg-blue-700 hover:bg-blue-600"
                            }`}
                        >
                            Orders
                        </button>
                        <button
                            onClick={() => setActiveSection("products")}
                            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 cursor-pointer ${
                                activeSection === "products"
                                    ? "bg-white text-blue-600 shadow-lg transform scale-105"
                                    : "bg-blue-700 hover:bg-blue-600"
                            }`}
                        >
                            Products
                        </button>
                        <SignedIn>
                            <SignOutButton>
                                <button className="bg-red-500 cursor-pointer hover:bg-red-600 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl">
                                    Logout
                                </button>
                            </SignOutButton>
                        </SignedIn>
                    </div>
                </nav>

                <div className="p-8">
                    {activeSection === "orders" && (
                        <>
                            <div className="grid grid-cols-5 gap-6 mb-8">
                                <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-200">
                                    <h3 className="text-xl font-semibold text-gray-800 mb-2">Total Earnings</h3>
                                    <p className="text-3xl font-bold text-green-600">${totalEarnings.toLocaleString()}</p>
                                </div>
                                <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-200">
                                    <h3 className="text-xl font-semibold text-gray-800 mb-2">Total Orders</h3>
                                    <p className="text-3xl font-bold text-blue-600">{totalOrders}</p>
                                </div>
                                <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-200">
                                    <h3 className="text-xl font-semibold text-gray-800 mb-2">Pending Orders</h3>
                                    <p className="text-3xl font-bold text-yellow-600">{pendingOrders}</p>
                                </div>
                                <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-200">
                                    <h3 className="text-xl font-semibold text-gray-800 mb-2">Shipped Orders</h3>
                                    <p className="text-3xl font-bold text-orange-600">{shippedOrders}</p>
                                </div>
                                <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-200">
                                    <h3 className="text-xl font-semibold text-gray-800 mb-2">Delivered Orders</h3>
                                    <p className="text-3xl font-bold text-green-600">{deliveredOrders}</p>
                                </div>
                            </div>

                            <div className="mb-6 space-x-4">
                                {["All", "pending", "shipped", "delivered"].map((status) => (
                                    <button
                                        key={status}
                                        onClick={() => setFilter(status)}
                                        className={`px-6 py-3 cursor-pointer rounded-lg font-semibold transition-all duration-200 ${
                                            filter === status
                                                ? "bg-blue-600 text-white shadow-lg transform scale-105"
                                                : "bg-white text-gray-700 hover:bg-gray-50 shadow"
                                        }`}
                                    >
                                        {status.charAt(0).toUpperCase() + status.slice(1)}
                                    </button>
                                ))}
                            </div>

                            {filteredOrders.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className="text-xl text-gray-600">No orders found</p>
                                </div>
                            ) : (
                                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                                    <table className="w-full">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Name</th>
                                                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Phone</th>
                                                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Email</th>
                                                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Total</th>
                                                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Status</th>
                                                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {filteredOrders.map((order) => (
                                                <tr key={order._id} className="hover:bg-gray-50 transition-colors duration-200">
                                                    <td className="px-6 py-4">{order.fullName}</td>
                                                    <td className="px-6 py-4">{order.phone}</td>
                                                    <td className="px-6 py-4">{order.email}</td>
                                                    <td className="px-6 py-4 font-semibold text-green-600">${round(order.total, 2)}</td>
                                                    <td className="px-6 py-4">
                                                        <span
                                                            className={`px-3 py-1 rounded-full text-sm font-medium ${
                                                                order.status === "pending"
                                                                    ? "bg-yellow-100 text-yellow-800"
                                                                    : order.status === "shipped"
                                                                        ? "bg-blue-100 text-blue-800"
                                                                        : "bg-green-100 text-green-800"
                                                            }`}
                                                        >
                                                            {order.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 space-x-3">
                                                        <button
                                                            onClick={() => toggleOrderDetails(order._id)}
                                                            className="text-blue-600 cursor-pointer hover:text-blue-800 font-medium"
                                                        >
                                                            {selectedOrderId === order._id ? "Hide" : "Details"}
                                                        </button>
                                                        <select
                                                            value={order.status || ""}
                                                            onChange={(e) => handleStatusChange(order._id, e.target.value)}
                                                            className="bg-white border cursor-pointer border-gray-300 rounded-lg px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        >
                                                            <option value="pending">Pending</option>
                                                            <option value="shipped">Shipped</option>
                                                            <option value="delivered">Delivered</option>
                                                        </select>
                                                        <button
                                                            onClick={() => handleDelete(order._id)}
                                                            className="text-red-600 cursor-pointer hover:text-red-800 font-medium"
                                                        >
                                                            Delete
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            {selectedOrderId && selectedOrderDetails && (
                                <div className="mt-8 bg-white p-6 rounded-xl shadow-lg">
                                    <h2 className="text-2xl font-semibold text-gray-800 mb-6">Order ID: {selectedOrderDetails._id}</h2>
                                    <p className="mb-4 text-gray-600">Address: {selectedOrderDetails.address}, {selectedOrderDetails.city}, {selectedOrderDetails.zipCode}</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                        {selectedOrderDetails.cartItems.map((item, index) => (
                                            <div
                                                key={item._id || item._key || index}
                                                className="flex flex-col items-center p-4 border rounded-lg hover:shadow-md transition-shadow duration-200"
                                            >
                                                {item.image?.asset?.url ? (
                                                    <Image
                                                        src={item.image.asset.url}
                                                        alt={item.name}
                                                        className="w-24 h-24 object-cover rounded-lg mb-4"
                                                    />
                                                ) : (
                                                    <div className="w-24 h-24 bg-gray-200 rounded-lg mb-4 flex items-center justify-center">No Image</div>
                                                )}
                                                <span className="text-gray-800 font-medium text-center">{item.name}</span>
                                                <span className="text-sm text-gray-500">Qty: {item.quantity} | Price: ${item.price}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {activeSection === "products" && (
                        <>
                            <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                                <h2 className="text-2xl font-semibold text-gray-800 mb-6">Add New Product</h2>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                                    
                                    <input
                                        type="text"
                                        placeholder="Product Name"
                                        className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 col-span-1"
                                        value={newProduct.name}
                                        onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                                    />
                                    <input
                                        type="number"
                                        placeholder="Price"
                                        className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={newProduct.price || ''}
                                        onChange={(e) => setNewProduct({ ...newProduct, price: Number(e.target.value) })}
                                    />
                                    <input
                                        type="number"
                                        placeholder="Stock"
                                        className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={newProduct.stock || ''}
                                        onChange={(e) => setNewProduct({ ...newProduct, stock: Number(e.target.value) })}
                                    />
                                    <select
                                        value={newProduct.category}
                                        onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                                        className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                    >
                                        <option value="">Select Category</option>
                                        {availableCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                        <option value="other">Other (Type manually)</option>
                                    </select>
                                    {newProduct.category === "other" && (
                                        <input
                                            type="text"
                                            placeholder="Type category manually"
                                            className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 mt-2"
                                            value={newProduct.categoryManual || ""}
                                            onChange={e => setNewProduct({ ...newProduct, categoryManual: e.target.value })}
                                        />
                                    )}
                                    
                                    <div className="flex items-center space-x-4 border border-gray-300 rounded-lg px-4 py-2 col-span-2">
                                        <label className="text-gray-600 font-medium">Sizes:</label>
                                        {availableSizes.map(size => (
                                            <label key={size} className="inline-flex items-center">
                                                <input
                                                    type="checkbox"
                                                    value={size}
                                                    checked={newProduct.sizes.includes(size)}
                                                    onChange={(e) => {
                                                        const { checked, value } = e.target;
                                                        setNewProduct(prev => ({
                                                            ...prev,
                                                            sizes: checked
                                                                ? [...prev.sizes, value]
                                                                : prev.sizes.filter(s => s !== value)
                                                        }));
                                                    }}
                                                    className="form-checkbox h-5 w-5 text-blue-600"
                                                />
                                                <span className="ml-2 text-gray-700">{size.toUpperCase()}</span>
                                            </label>
                                        ))}
                                    </div>
                                    
                                    <textarea
                                        placeholder="Description"
                                        className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 col-span-3"
                                        value={newProduct.description}
                                        onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                                    />

                                    <hr className="col-span-3 my-4 border-t border-gray-200" />
                                    <h3 className="text-xl font-semibold text-gray-700 col-span-3">Add Color Variants</h3>

                                    <select
                                        value={currentVariant.color}
                                        onChange={(e) => setCurrentVariant({ ...currentVariant, color: e.target.value })}
                                        className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                    >
                                        <option value="" disabled>Select Color</option>
                                        {availableColors
                                            .filter(color => !selectedColors.includes(color)) // Filter out already added colors
                                            .map(color => (
                                                <option key={color} value={color}>{color.charAt(0).toUpperCase() + color.slice(1)}</option>
                                            ))}
                                    </select>
                                    
                                    <div className="col-span-1">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                            onChange={(e) => setCurrentVariant({ ...currentVariant, imageFile: e.target.files ? e.target.files[0] : null })}
                                        />
                                    </div>

                                    <button
                                        onClick={addNewVariantToProduct}
                                        disabled={!currentVariant.color || !currentVariant.imageFile || selectedColors.includes(currentVariant.color)}
                                        className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-6 py-2 rounded-lg transition-colors duration-200 disabled:bg-gray-400"
                                    >
                                        Add Variant
                                    </button>

                                    <div className="col-span-3 p-4 border border-dashed border-gray-300 rounded-lg bg-gray-50">
                                        <h4 className="font-semibold text-gray-700 mb-2">Variants to be Added ({newVariants.length}):</h4>
                                        <div className="flex flex-wrap gap-3">
                                            {newVariants.map((v, index) => (
                                                <span key={v.color} className="bg-blue-100 text-blue-800 text-sm font-medium mr-2 px-3 py-1 rounded-full flex items-center">
                                                    {v.color.charAt(0).toUpperCase() + v.color.slice(1)} 
                                                    <button 
                                                        onClick={() => setNewVariants(prev => prev.filter((_, i) => i !== index))} 
                                                        className="ml-2 text-red-500 hover:text-red-700"
                                                    >
                                                        &times;
                                                    </button>
                                                </span>
                                            ))}
                                            {newVariants.length === 0 && <p className="text-gray-500 italic text-sm">No variants added yet.</p>}
                                        </div>
                                    </div>
                                    
                                    <button
                                        onClick={handleAddProduct}
                                        disabled={newVariants.length === 0}
                                        className="bg-green-500 hover:bg-green-600 text-white font-semibold px-6 py-2 rounded-lg transition-colors duration-200 col-span-3 mt-4 disabled:bg-gray-400"
                                    >
                                        CREATE PRODUCT WITH {newVariants.length} VARIANT(S)
                                    </button>

                                </div>
                            </div>

                            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Image</th>
                                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Name</th>
                                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Price</th>
                                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Stock</th>
                                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {products.map((product) => (
                                            <tr key={product._id} className="hover:bg-gray-50 transition-colors duration-200">
                                                <td className="px-6 py-4">
                                                    {getProductImageUrl(product) ? (
                                                        <Image
                                                            width={1000}
                                                            height={1000}
                                                            src={getProductImageUrl(product) as string}
                                                            alt={product.name}
                                                            className="w-16 h-16 object-cover rounded-lg"
                                                        />
                                                    ) : (
                                                        <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center text-xs">No Image</div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">{product.name}</td>
                                                <td className="px-6 py-4">${product.price}</td>
                                                <td className="px-6 py-4">{product.stock}</td>
                                                <td className="px-6 py-4 space-x-3">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedProduct(product);
                                                            setIsEditing(true);
                                                        }}
                                                        className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => confirmDeleteProduct(product._id)}
                                                        className="text-red-600 hover:text-red-800 font-medium cursor-pointer"
                                                    >
                                                        Delete
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {isEditing && selectedProduct && (
                                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                                    <div className="bg-white p-8 rounded-xl w-full max-w-xl shadow-2xl">
                                        <h2 className="text-2xl font-semibold text-gray-800 mb-6">Edit Product: {selectedProduct.name}</h2>
                                        <div className="space-y-4">
                                            <input
                                                type="text"
                                                placeholder="Product Name"
                                                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                value={selectedProduct.name}
                                                onChange={(e) => setSelectedProduct({...selectedProduct, name: e.target.value})}
                                            />
                                            <input
                                                type="number"
                                                placeholder="Price"
                                                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                value={selectedProduct.price}
                                                onChange={(e) => setSelectedProduct({...selectedProduct, price: Number(e.target.value)})}
                                            />
                                            <input
                                                type="number"
                                                placeholder="Stock"
                                                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                value={selectedProduct.stock}
                                                onChange={(e) => setSelectedProduct({...selectedProduct, stock: Number(e.target.value)})}
                                            />
                                             <select
                                                value={selectedProduct.category}
                                                onChange={(e) => setSelectedProduct({ ...selectedProduct, category: e.target.value })}
                                                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                            >
                                                <option value="">Select Category</option>
                                                {availableCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                            </select>

                                            <div className="flex flex-wrap items-center space-x-4 border border-gray-300 rounded-lg px-4 py-2">
                                                <label className="text-gray-600 font-medium mr-2">Sizes:</label>
                                                {availableSizes.map(size => (
                                                    <label key={size} className="inline-flex items-center">
                                                        <input
                                                            type="checkbox"
                                                            value={size}
                                                            checked={selectedProduct.sizes?.includes(size) || false}
                                                            onChange={(e) => {
                                                                const { checked, value } = e.target;
                                                                setSelectedProduct(prev => {
                                                                    const currentSizes = prev?.sizes || [];
                                                                    const newSizes = checked
                                                                        ? [...currentSizes, value]
                                                                        : currentSizes.filter(s => s !== value);
                                                                    return { ...prev!, sizes: newSizes };
                                                                });
                                                            }}
                                                            className="form-checkbox h-5 w-5 text-blue-600"
                                                        />
                                                        <span className="ml-2 text-gray-700">{size.toUpperCase()}</span>
                                                    </label>
                                                ))}
                                            </div>
                                            
                                            <textarea
                                                placeholder="Description"
                                                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                value={selectedProduct.description}
                                                onChange={(e) => setSelectedProduct({...selectedProduct, description: e.target.value})}
                                            />

                                            <div className="flex justify-end space-x-4">
                                                <button
                                                    onClick={() => {
                                                        setSelectedProduct(null);
                                                        setIsEditing(false);
                                                    }}
                                                    className="px-6 py-2 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors duration-200"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={() => handleEditProduct(selectedProduct)}
                                                    className="px-6 py-2 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors duration-200"
                                                >
                                                    Save Changes
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </ProtectedRoute>
    );
};

export default AdminDashboard;