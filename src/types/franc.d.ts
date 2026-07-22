declare module 'franc' {
  export default function franc(
    value: string,
    options?: { minLength?: number; only?: string[]; ignore?: string[] },
  ): string;
}
