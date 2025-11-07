import mangalaSpiral from '@assets/generated_images/Golden_spiral_mangala_chihna_7c8c1b8a.png';
import mangalaFlame from '@assets/generated_images/Golden_flame_mangala_chihna_20cfce30.png';
import mangalaSwan from '@assets/generated_images/Golden_swan_mangala_chihna_6c23300a.png';
import mangalaDoubleSpiral from '@assets/generated_images/Golden_double_spiral_chihna_fb7a0937.png';

export function MangalaWatermarks() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-[0.08] z-0">
      {/* Row 1 */}
      <img src={mangalaSpiral} alt="" className="absolute w-16 h-16" style={{ top: '5%', left: '8%' }} draggable={false} />
      <img src={mangalaFlame} alt="" className="absolute w-20 h-20" style={{ top: '8%', left: '30%' }} draggable={false} />
      <img src={mangalaSwan} alt="" className="absolute w-14 h-14" style={{ top: '3%', left: '55%' }} draggable={false} />
      <img src={mangalaDoubleSpiral} alt="" className="absolute w-18 h-18" style={{ top: '6%', left: '78%' }} draggable={false} />
      <img src={mangalaSpiral} alt="" className="absolute w-16 h-16" style={{ top: '4%', left: '92%' }} draggable={false} />
      
      {/* Row 2 */}
      <img src={mangalaDoubleSpiral} alt="" className="absolute w-18 h-18" style={{ top: '18%', left: '12%' }} draggable={false} />
      <img src={mangalaSpiral} alt="" className="absolute w-16 h-16" style={{ top: '22%', left: '42%' }} draggable={false} />
      <img src={mangalaFlame} alt="" className="absolute w-14 h-14" style={{ top: '20%', left: '68%' }} draggable={false} />
      <img src={mangalaSwan} alt="" className="absolute w-20 h-20" style={{ top: '17%', left: '85%' }} draggable={false} />
      
      {/* Row 3 */}
      <img src={mangalaSwan} alt="" className="absolute w-20 h-20" style={{ top: '35%', left: '5%' }} draggable={false} />
      <img src={mangalaDoubleSpiral} alt="" className="absolute w-16 h-16" style={{ top: '38%', left: '25%' }} draggable={false} />
      <img src={mangalaSpiral} alt="" className="absolute w-18 h-18" style={{ top: '33%', left: '50%' }} draggable={false} />
      <img src={mangalaFlame} alt="" className="absolute w-14 h-14" style={{ top: '36%', left: '72%' }} draggable={false} />
      <img src={mangalaSwan} alt="" className="absolute w-16 h-16" style={{ top: '39%', left: '90%' }} draggable={false} />
      
      {/* Row 4 */}
      <img src={mangalaFlame} alt="" className="absolute w-14 h-14" style={{ top: '52%', left: '10%' }} draggable={false} />
      <img src={mangalaSwan} alt="" className="absolute w-16 h-16" style={{ top: '48%', left: '35%' }} draggable={false} />
      <img src={mangalaDoubleSpiral} alt="" className="absolute w-20 h-20" style={{ top: '55%', left: '60%' }} draggable={false} />
      <img src={mangalaSpiral} alt="" className="absolute w-18 h-18" style={{ top: '50%', left: '82%' }} draggable={false} />
      
      {/* Row 5 */}
      <img src={mangalaSpiral} alt="" className="absolute w-16 h-16" style={{ top: '68%', left: '7%' }} draggable={false} />
      <img src={mangalaFlame} alt="" className="absolute w-18 h-18" style={{ top: '72%', left: '28%' }} draggable={false} />
      <img src={mangalaSwan} alt="" className="absolute w-14 h-14" style={{ top: '70%', left: '52%' }} draggable={false} />
      <img src={mangalaDoubleSpiral} alt="" className="absolute w-16 h-16" style={{ top: '67%', left: '75%' }} draggable={false} />
      <img src={mangalaSpiral} alt="" className="absolute w-20 h-20" style={{ top: '71%', left: '93%' }} draggable={false} />
      
      {/* Row 6 */}
      <img src={mangalaDoubleSpiral} alt="" className="absolute w-16 h-16" style={{ top: '85%', left: '15%' }} draggable={false} />
      <img src={mangalaSpiral} alt="" className="absolute w-20 h-20" style={{ top: '88%', left: '40%' }} draggable={false} />
      <img src={mangalaFlame} alt="" className="absolute w-14 h-14" style={{ top: '83%', left: '65%' }} draggable={false} />
      <img src={mangalaSwan} alt="" className="absolute w-18 h-18" style={{ top: '90%', left: '85%' }} draggable={false} />
      
      {/* Extra scattered symbols */}
      <img src={mangalaSpiral} alt="" className="absolute w-14 h-14" style={{ top: '12%', left: '62%' }} draggable={false} />
      <img src={mangalaFlame} alt="" className="absolute w-16 h-16" style={{ top: '28%', left: '15%' }} draggable={false} />
      <img src={mangalaSwan} alt="" className="absolute w-14 h-14" style={{ top: '42%', left: '38%' }} draggable={false} />
      <img src={mangalaDoubleSpiral} alt="" className="absolute w-18 h-18" style={{ top: '58%', left: '45%' }} draggable={false} />
      <img src={mangalaSpiral} alt="" className="absolute w-16 h-16" style={{ top: '78%', left: '58%' }} draggable={false} />
    </div>
  );
}
