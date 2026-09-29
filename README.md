# React E-Commerce Project — Beginner to Full App

This repository contains the complete **React e-commerce application** built throughout the course.
The project is designed to take you from **zero React knowledge** to building a **real, production-style application** using modern React patterns.

---

## 🤖 CodeRabbit Integration (Required)

This project uses **CodeRabbit** to automatically review pull requests and catch bugs, best-practice issues, and improvements.

### How to Integrate CodeRabbit

1. Go to **[https://coderabbit.link/pedro](https://coderabbit.link/pedro)**
2. Install CodeRabbit on your GitHub account
3. Enable it for this repository
4. Open a Pull Request
5. CodeRabbit will automatically:
   - Review your code
   - Leave inline comments
   - Highlight bugs, anti-patterns, and improvements

> Code reviews are an essential part of real-world development.
> CodeRabbit simulates having a senior developer reviewing your work.

---

## 📚 Topics Covered (With Code)

---

## 1. Project Setup & Tooling

We initialize the project using **Vite**, which provides a fast development environment.

```bash
npm create vite@latest
npm install
npm run dev
```

We clean up boilerplate files to start with a minimal structure.

---

## 2. React Fundamentals

### Components & JSX

Components are functions that return JSX.

```jsx
function Button() {
  return <button>Click me</button>;
}
```

JSX allows us to mix JavaScript and HTML-like syntax.

---

## 3. Props & Component Communication

Props allow components to receive data.

```jsx
function Product({ name }) {
  return <h2>{name}</h2>;
}
```

Used to make components reusable and dynamic.

---

## 4. State Management with `useState`

State allows components to store and update data.

```jsx
const [count, setCount] = useState(0);

<button onClick={() => setCount(count + 1)}>+</button>;
```

We use state for:

- Forms
- Errors
- UI updates
- Cart logic

---

## 5. Event Handling

React uses camelCase event handlers.

```jsx
<input onChange={(e) => setEmail(e.target.value)} />
```

Used for:

- Form inputs
- Buttons
- User interactions

---

## 6. Conditional Rendering

Render UI based on conditions.

```jsx
{
  error && <p>{error}</p>;
}
```

Used for:

- Errors
- Auth state
- Cart indicators

---

## 7. Authentication Logic (Frontend)

We implement **signup and login logic** using in-memory data and localStorage.

```js
const user = users.find((u) => u.email === email && u.password === password);

if (!user) {
  return { success: false, error: "Invalid email or password" };
}
```

We intentionally return **generic errors** for security reasons.

---

## 8. Persisting Auth State

We store logged-in users in `localStorage`.

```js
localStorage.setItem("user", JSON.stringify(user));
```

This allows session persistence on refresh.

---

## 9. React Context API

Context allows sharing global state.

```jsx
export const AuthContext = createContext();

<AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>;
```

Used for:

- Authentication
- Cart state

---

## 10. Custom Hooks

Custom hooks abstract reusable logic.

```js
export function useAuth() {
  return useContext(AuthContext);
}
```

This removes repetitive imports and improves readability.

---

## 11. Routing with React Router

We define application routes.

```jsx
<Route path="/" element={<Home />} />
<Route path="/login" element={<Login />} />
```

Used for page navigation.

---

## 12. Programmatic Navigation

We redirect users using `useNavigate`.

```js
const navigate = useNavigate();
navigate("/");
```

Used after login and error handling.

---

## 13. Dynamic Routes & URL Params

Dynamic routes allow variable URLs.

```jsx
<Route path="/products/:id" element={<ProductDetails />} />
```

Access params using:

```js
const { id } = useParams();
```

---

## 14. Side Effects with `useEffect`

Run logic when components render.

```js
useEffect(() => {
  fetchProduct();
}, [id]);
```

Used for:

- Fetching data
- Syncing UI with params

---

## 15. Handling Loading & Null States

Prevent crashes when data is unavailable.

```jsx
if (!product) return <h1>Loading...</h1>;
```

Essential for real-world apps.

---

## 16. Product System

We render products dynamically.

```jsx
products.map((product) => <ProductCard key={product.id} product={product} />);
```

Each product has:

- ID
- Name
- Price
- Image
- Description

---

## 17. Cart Context (Global State)

Cart items stored as:

```js
{ id: 2, quantity: 3 }
```

Cart state lives in Context so it’s accessible everywhere.

---

## 18. Adding Items to Cart

Prevent duplicate entries.

```js
if (existingItem) {
  quantity += 1;
} else {
  add new item
}
```

State updates are immutable.

---

## 19. Updating Cart Quantities

We update items using `map`.

```js
cartItems.map((item) =>
  item.id === id ? { ...item, quantity: item.quantity + 1 } : item,
);
```

---

## 20. Removing Items from Cart

Remove items using `filter`.

```js
cartItems.filter((item) => item.id !== id);
```

---

## 21. Checkout Page

Displays:

- Cart items
- Quantity controls
- Total price

```js
const total = cartItems.reduce((sum, item) => {
  return sum + item.price * item.quantity;
}, 0);
```

---

## 22. Placing an Order (Mock)

Simulates checkout.

```js
alert("Order placed!");
clearCart();
```

Used to demonstrate full flow.

---

## 23. Accessibility & Best Practices

- Keys in lists
- Avoiding span buttons
- Cleaning console logs
- Handling edge cases

---

## 24. Deployment with Vercel

Deploy the app publicly.

```text
Vercel → Import GitHub Repo → Deploy
```

Works for any React app, not just Next.js.

---

## 🎯 Learning Outcome

After finishing this project, you can:

- Build React apps from scratch
- Manage complex UI state
- Use Context & custom hooks
- Implement routing and auth flows
- Build real-world features
- Deploy production apps

---
