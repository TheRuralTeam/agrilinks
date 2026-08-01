import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Eye, EyeOff, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";

interface MarketPrice {
  id: string;
  product: string;
  unit: string;
  price_kz: number;
  market_location: string;
  market_type: string;
  date: string;
  price_change_pct: number;
  published: boolean;
}

const emptyForm = {
  id: "",
  product: "",
  unit: "Caixa 20kg",
  price_kz: "",
  market_location: "",
  market_type: "informal",
  date: new Date().toISOString().slice(0, 10),
};

const MarketPricesManager = () => {
  const [prices, setPrices] = useState<MarketPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [historyOf, setHistoryOf] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("market_prices")
      .select("*")
      .order("date", { ascending: false })
      .limit(500);
    if (error) toast.error("Erro ao carregar preços: " + error.message);
    setPrices((data as MarketPrice[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setForm({ ...emptyForm });
    setOpen(true);
  };

  const openEdit = (p: MarketPrice) => {
    setForm({
      id: p.id,
      product: p.product,
      unit: p.unit,
      price_kz: String(p.price_kz),
      market_location: p.market_location,
      market_type: p.market_type,
      date: p.date,
    });
    setOpen(true);
  };

  const computeChange = async (product: string, location: string, type: string, date: string, price: number) => {
    const { data } = await supabase
      .from("market_prices")
      .select("price_kz, date")
      .eq("product", product)
      .eq("market_location", location)
      .eq("market_type", type)
      .lt("date", date)
      .order("date", { ascending: false })
      .limit(1);
    const previous = data?.[0]?.price_kz;
    if (!previous || Number(previous) === 0) return 0;
    return Number((((price - Number(previous)) / Number(previous)) * 100).toFixed(2));
  };

  const save = async () => {
    const price = Number(form.price_kz);
    if (!form.product.trim() || !form.market_location.trim() || !price || price <= 0) {
      toast.error("Preencha produto, localização e um preço válido.");
      return;
    }
    setSaving(true);
    try {
      const change = await computeChange(
        form.product.trim(),
        form.market_location.trim(),
        form.market_type,
        form.date,
        price,
      );

      const payload = {
        product: form.product.trim(),
        unit: form.unit.trim() || "kg",
        price_kz: price,
        market_location: form.market_location.trim(),
        market_type: form.market_type,
        date: form.date,
        price_change_pct: change,
      };

      const { error } = form.id
        ? await supabase.from("market_prices").update(payload).eq("id", form.id)
        : await supabase.from("market_prices").insert(payload);

      if (error) throw error;
      toast.success(form.id ? "Preço actualizado." : "Preço publicado.");
      setOpen(false);
      load();
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível guardar o preço.");
    } finally {
      setSaving(false);
    }
  };

  const togglePublished = async (p: MarketPrice) => {
    const { error } = await supabase
      .from("market_prices")
      .update({ published: !p.published })
      .eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(p.published ? "Preço despublicado." : "Preço publicado.");
    load();
  };

  const remove = async (p: MarketPrice) => {
    const { error } = await supabase.from("market_prices").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Preço removido.");
    load();
  };

  const history = historyOf ? prices.filter((p) => p.product === historyOf) : [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Preços de Mercado</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="h-4 w-4 mr-1" /> Actualizar
            </Button>
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" /> Novo preço
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">A carregar preços...</p>
          ) : prices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum preço registado ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead className="font-mono">Preço (Kz)</TableHead>
                    <TableHead>Variação</TableHead>
                    <TableHead>Mercado</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prices.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        <button className="underline-offset-2 hover:underline" onClick={() => setHistoryOf(p.product)}>
                          {p.product}
                        </button>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.unit}</TableCell>
                      <TableCell className="font-mono tabular-nums">{Number(p.price_kz).toLocaleString("pt-AO")}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1 font-mono text-xs ${
                            Number(p.price_change_pct) > 0
                              ? "text-emerald-600"
                              : Number(p.price_change_pct) < 0
                              ? "text-destructive"
                              : "text-muted-foreground"
                          }`}
                        >
                          {Number(p.price_change_pct) >= 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {Number(p.price_change_pct).toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell>{p.market_location}</TableCell>
                      <TableCell>
                        <Badge variant={p.market_type === "formal" ? "default" : "secondary"}>
                          {p.market_type === "formal" ? "Formal" : "Informal"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{p.date}</TableCell>
                      <TableCell>
                        <Badge variant={p.published ? "default" : "outline"}>
                          {p.published ? "Publicado" : "Oculto"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => togglePublished(p)}>
                            {p.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => remove(p)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar preço" : "Novo preço de mercado"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Produto (ex: Tomate)"
              value={form.product}
              onChange={(e) => setForm({ ...form, product: e.target.value })}
            />
            <Input
              placeholder="Unidade (ex: Caixa 20kg)"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            />
            <Input
              type="number"
              placeholder="Preço em Kz"
              value={form.price_kz}
              onChange={(e) => setForm({ ...form, price_kz: e.target.value })}
            />
            <Input
              placeholder="Mercado / localização (ex: Luanda — Roque Santeiro)"
              value={form.market_location}
              onChange={(e) => setForm({ ...form, market_location: e.target.value })}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant={form.market_type === "informal" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setForm({ ...form, market_type: "informal" })}
              >
                Informal
              </Button>
              <Button
                type="button"
                variant={form.market_type === "formal" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setForm({ ...form, market_type: "formal" })}
              >
                Formal
              </Button>
            </div>
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <p className="text-xs text-muted-foreground">
              A variação percentual é calculada automaticamente face ao último preço registado para o mesmo produto e mercado.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "A guardar..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyOf} onOpenChange={(o) => !o && setHistoryOf(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Histórico — {historyOf}</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-2">
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between text-sm border rounded-lg px-3 py-2">
                <span className="font-mono text-xs">{h.date}</span>
                <span>{h.market_location}</span>
                <span className="font-mono tabular-nums font-semibold">
                  {Number(h.price_kz).toLocaleString("pt-AO")} Kz
                </span>
                <span
                  className={`font-mono text-xs ${
                    Number(h.price_change_pct) > 0 ? "text-emerald-600" : Number(h.price_change_pct) < 0 ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {Number(h.price_change_pct).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MarketPricesManager;
