import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Auth/Login";
import Signup from "./pages/Auth/Signup";
import Checkout from "./pages/Checkout";
import Navbar from "./components/Navbar";

import "./App.css";
import AuthProvider from "./context/AuthContext";
import ProductDetails from "./pages/ProductDetails";
import CartProvider from "./context/CartContext";
import AdminRoute from "./components/AdminRoute";
import ProductList from "./pages/admin/ProductList";
import ProductEditor from "./pages/admin/ProductEditor";
import AuthenticatedRoute from "./components/AuthenticatedRoute";
import Orders from "./pages/Orders";
import OrderDetails from "./pages/OrderDetails";
import Profile from "./pages/Profile";

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <div className="app">
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/auth" element={<Navigate to="/signup" replace />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/products/:id" element={<ProductDetails />} />
            <Route element={<AuthenticatedRoute />}>
              <Route path="/profile" element={<Profile />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/orders/:id" element={<OrderDetails />} />
            </Route>
            <Route element={<AdminRoute />}>
              <Route path="/admin/orders" element={<Orders manage />} />
              <Route path="/admin/orders/:id" element={<OrderDetails manage />} />
              <Route path="/admin/products" element={<ProductList />} />
              <Route path="/admin/products/new" element={<ProductEditor />} />
              <Route path="/admin/products/:id/edit" element={<ProductEditor />} />
            </Route>
          </Routes>
        </div>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
