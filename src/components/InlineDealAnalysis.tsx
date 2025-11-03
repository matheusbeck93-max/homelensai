import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Home, DollarSign, Loader2 } from "lucide-react";
import { calculatePropertyScores, getScoreColor } from "@/utils/propertyScoring";

interface PropertyData {
  address: string;
  city: string;
  state: string;
  zip: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  yearBuilt?: number;
  lotSize?: number;
}

export default function InlineDealAnalysis({ initialData }: { initialData?: Partial<PropertyData> }) {
  const [inputs, setInputs] = useState<PropertyData>({
    address: initialData?.address || "",
    city: initialData?.city || "",
    state: initialData?.state || "",
    zip: initialData?.zip || "",
    price: initialData?.price || 0,
    beds: initialData?.beds || 3,
    baths: initialData?.baths || 2,
    sqft: initialData?.sqft || 1500,
    yearBuilt: initialData?.yearBuilt || 2000,
    lotSize: initialData?.lotSize || 5000
  });

  const [investorInputs, setInvestorInputs] = useState({
    arv: 0,
    rehabBudget: 0
  });

  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    
    // Calculate buyer metrics
    const downPayment = inputs.price * 0.2;
    const loanAmount = inputs.price - downPayment;
    const monthlyRate = 0.068 / 12;
    const numPayments = 30 * 12;
    const monthlyPayment = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
                          (Math.pow(1 + monthlyRate, numPayments) - 1);
    const pmi = downPayment < inputs.price * 0.2 ? loanAmount * 0.005 / 12 : 0;
    const propertyTax = inputs.price * 0.012 / 12;
    const insurance = 150;
    const hoa = 0;
    const totalMonthly = monthlyPayment + pmi + propertyTax + insurance + hoa;

    // Calculate investor metrics
    const arv = investorInputs.arv || inputs.price * 1.3;
    const rehabCost = investorInputs.rehabBudget || inputs.price * 0.15;
    const maxOffer = arv * 0.7 - rehabCost;
    const totalInvestment = inputs.price + rehabCost + 5000;
    const profit = arv - totalInvestment - (arv * 0.08);
    const roi = (profit / totalInvestment) * 100;
    const cashOnCash = ((2500 * 12 - totalMonthly * 12) / downPayment) * 100;
    const capRate = ((2500 * 12 - totalMonthly * 12) / inputs.price) * 100;

    // Calculate market intelligence scores
    const scores = calculatePropertyScores({
      price: inputs.price,
      beds: inputs.beds,
      baths: inputs.baths,
      sqft: inputs.sqft,
      taxes: inputs.price * 0.012 // Estimate 1.2% property tax
    });

    setAnalysisResult({
      buyer: {
        downPayment,
        monthlyPayment,
        pmi,
        propertyTax,
        insurance,
        totalMonthly
      },
      investor: {
        arv,
        rehabCost,
        maxOffer,
        totalInvestment,
        profit,
        roi,
        cashOnCash,
        capRate
      },
      scores
    });
    
    setLoading(false);
  };

  return (
    <Card className="my-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Deal Analysis Tool
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <Label>Address</Label>
            <Input value={inputs.address} onChange={(e) => setInputs({...inputs, address: e.target.value})} />
          </div>
          <div>
            <Label>City</Label>
            <Input value={inputs.city} onChange={(e) => setInputs({...inputs, city: e.target.value})} />
          </div>
          <div>
            <Label>State</Label>
            <Input value={inputs.state} onChange={(e) => setInputs({...inputs, state: e.target.value})} />
          </div>
          <div>
            <Label>Price</Label>
            <Input type="number" value={inputs.price} onChange={(e) => setInputs({...inputs, price: parseFloat(e.target.value)})} />
          </div>
          <div>
            <Label>Beds</Label>
            <Input type="number" value={inputs.beds} onChange={(e) => setInputs({...inputs, beds: parseInt(e.target.value)})} />
          </div>
          <div>
            <Label>Baths</Label>
            <Input type="number" value={inputs.baths} onChange={(e) => setInputs({...inputs, baths: parseFloat(e.target.value)})} />
          </div>
          <div>
            <Label>Sq Ft</Label>
            <Input type="number" value={inputs.sqft} onChange={(e) => setInputs({...inputs, sqft: parseInt(e.target.value)})} />
          </div>
          <div>
            <Label>ARV (optional)</Label>
            <Input type="number" value={investorInputs.arv} onChange={(e) => setInvestorInputs({...investorInputs, arv: parseFloat(e.target.value)})} />
          </div>
          <div>
            <Label>Rehab Budget (optional)</Label>
            <Input type="number" value={investorInputs.rehabBudget} onChange={(e) => setInvestorInputs({...investorInputs, rehabBudget: parseFloat(e.target.value)})} />
          </div>
        </div>

        <Button onClick={handleAnalyze} disabled={loading} className="w-full">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Analyze Deal
        </Button>

        {analysisResult && (
          <div className="space-y-4 mt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Equity Growth</p>
                    <Badge className={`mt-1 ${getScoreColor(analysisResult.scores.equityGrowth)}`}>
                      {analysisResult.scores.equityGrowth}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Market Momentum</p>
                    <Badge className={`mt-1 ${getScoreColor(analysisResult.scores.marketMomentum)}`}>
                      {analysisResult.scores.marketMomentum}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Liquidity Risk</p>
                    <Badge className={`mt-1 ${getScoreColor(analysisResult.scores.liquidityRisk)}`}>
                      {analysisResult.scores.liquidityRisk}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Rentability</p>
                    <Badge className={`mt-1 ${getScoreColor(analysisResult.scores.rentability)}`}>
                      {analysisResult.scores.rentability}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="buyer">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="buyer">
                  <Home className="h-4 w-4 mr-1" />
                  Buyer View
                </TabsTrigger>
                <TabsTrigger value="investor">
                  <DollarSign className="h-4 w-4 mr-1" />
                  Investor View
                </TabsTrigger>
              </TabsList>

              <TabsContent value="buyer">
                <Card>
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex justify-between">
                      <span>Down Payment (20%):</span>
                      <strong>${analysisResult.buyer.downPayment.toLocaleString(undefined, {maximumFractionDigits: 0})}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Monthly P&I:</span>
                      <strong>${analysisResult.buyer.monthlyPayment.toLocaleString(undefined, {maximumFractionDigits: 0})}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Property Tax:</span>
                      <strong>${analysisResult.buyer.propertyTax.toLocaleString(undefined, {maximumFractionDigits: 0})}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Insurance:</span>
                      <strong>${analysisResult.buyer.insurance.toLocaleString(undefined, {maximumFractionDigits: 0})}</strong>
                    </div>
                    <div className="flex justify-between pt-2 border-t">
                      <span className="font-semibold">Total Monthly:</span>
                      <strong className="text-lg">${analysisResult.buyer.totalMonthly.toLocaleString(undefined, {maximumFractionDigits: 0})}</strong>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="investor">
                <Card>
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex justify-between">
                      <span>After Repair Value:</span>
                      <strong>${analysisResult.investor.arv.toLocaleString(undefined, {maximumFractionDigits: 0})}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Max Offer (70% Rule):</span>
                      <strong>${analysisResult.investor.maxOffer.toLocaleString(undefined, {maximumFractionDigits: 0})}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Rehab Cost:</span>
                      <strong>${analysisResult.investor.rehabCost.toLocaleString(undefined, {maximumFractionDigits: 0})}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Investment:</span>
                      <strong>${analysisResult.investor.totalInvestment.toLocaleString(undefined, {maximumFractionDigits: 0})}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Potential Profit:</span>
                      <strong className={analysisResult.investor.profit < 0 ? "text-destructive" : "text-green-600"}>
                        ${analysisResult.investor.profit.toLocaleString(undefined, {maximumFractionDigits: 0})}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>ROI:</span>
                      <strong className="text-lg">{analysisResult.investor.roi.toFixed(1)}%</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Cap Rate:</span>
                      <strong>{analysisResult.investor.capRate.toFixed(2)}%</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Cash-on-Cash:</span>
                      <strong>{analysisResult.investor.cashOnCash.toFixed(2)}%</strong>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
