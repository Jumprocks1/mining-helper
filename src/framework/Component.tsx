import { type Children } from "./createElement";

// note, these will work with JSX, but if you need a ref, you have to use `new Component()`
// you can still dump the class directly into the JSX tree
export abstract class Component {
    abstract Node: Children
}